import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'
import { sanitizeLimit, sanitizeObjectId, sanitizeSearchValue, sanitizeUpdatePayload } from '../utils/sanitizeQuery'
import { sanitizeComment } from '../utils/sanitizeQuery';
// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = 1,
            limit: rawLimit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query
        const limit = sanitizeLimit(rawLimit);
        const filters: FilterQuery<Partial<IOrder>> = {}

        const safeStatus = sanitizeSearchValue(status)

        if (safeStatus) {
            filters.status = safeStatus
        }

        const safeTotalAmountFrom = sanitizeSearchValue(totalAmountFrom)
        if (safeTotalAmountFrom) {
            const totalAmountFromNumber = Number(safeTotalAmountFrom)
            if (Number.isNaN(totalAmountFromNumber)) {
                throw new BadRequestError('Invalid totalAmountFrom')
            }
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: totalAmountFromNumber,
            }
        }

        const safeTotalAmountTo = sanitizeSearchValue(totalAmountTo)
        if (safeTotalAmountTo) {
            const totalAmountToNumber = Number(safeTotalAmountTo)
            if (Number.isNaN(totalAmountToNumber)) {
                throw new BadRequestError('Invalid totalAmountTo')
            }
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: totalAmountToNumber,
            }
        }

        const safeOrderDateFrom = sanitizeSearchValue(orderDateFrom)
        if (safeOrderDateFrom) {
            const parsedDate = new Date(safeOrderDateFrom)
            if (Number.isNaN(parsedDate.getTime())) {
                throw new BadRequestError('Invalid orderDateFrom')
            }
            filters.createdAt = {
                ...filters.createdAt,
                $gte: parsedDate,
            }
        }

        const safeOrderDateTo = sanitizeSearchValue(orderDateTo)
        if (safeOrderDateTo) {
            const parsedDate = new Date(safeOrderDateTo)
            if (Number.isNaN(parsedDate.getTime())) {
                throw new BadRequestError('Invalid orderDateTo')
            }
            filters.createdAt = {
                ...filters.createdAt,
                $lte: parsedDate,
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        const safeSearch = sanitizeSearchValue(search)

        if (safeSearch) {
            const searchRegex = new RegExp(escapeRegExp(safeSearch), 'i')
            const searchNumber = Number(safeSearch)

            const searchConditions: any[] = [{ 'products.title': searchRegex }]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: [
                        ...searchConditions,
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $toString: '$orderNumber' },
                                    regex: escapeRegExp(safeSearch),
                                    options: 'i',
                                },
                            },
                        },
                    ],
                },
            })

            filters.$or = searchConditions
        }

        const safePage = sanitizeSearchValue(page)
        const pageNumber = safePage ? Number(safePage) : 1
        if (safePage && Number.isNaN(pageNumber)) {
            throw new BadRequestError('Invalid page')
        }

        const safeSortField = sanitizeSearchValue(sortField)
        const allowedSortFields = ['createdAt', 'totalAmount', 'orderNumber', 'status']

        const safeSortFieldValue = allowedSortFields.includes(safeSortField)
            ? safeSortField
            : 'createdAt'

        const safeSortOrder = sanitizeSearchValue(sortOrder)
        const sortOrderValue = safeSortOrder === 'asc' ? 1 : -1

        const sort = {
            [safeSortFieldValue]: sortOrderValue,
        }

        aggregatePipeline.push(
            { $sort: sort },
            { $skip: (pageNumber - 1) * Number(limit) },
            { $limit: Number(limit) },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / Number(limit))

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: Number(page),
                pageSize: Number(limit),
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page = 1, limit = 5 } = req.query
        const options = {
            skip: (Number(page) - 1) * Number(limit),
            limit: Number(limit),
        }

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        const safeSearch = sanitizeSearchValue(search)

        if (safeSearch) {
            // если не экранировать то получаем Invalid regular expression: /+1/i: Nothing to repeat
            const searchRegex = new RegExp(escapeRegExp(safeSearch), 'i')
            const searchNumber = Number(safeSearch)
            const products = await Product.find({ title: searchRegex })
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                // eslint-disable-next-line max-len
                const matchesProductTitle = order.products.some((product) =>
                    productIds.some((id) => id.equals(product._id))
                )
                // eslint-disable-next-line max-len
                const matchesOrderNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / Number(limit))

        orders = orders.slice(options.skip, options.skip + options.limit)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: Number(page),
                pageSize: Number(limit),
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const safeOrderNumber = sanitizeSearchValue(req.params.orderNumber)
        const order = await Order.findOne({
            orderNumber: safeOrderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const safeOrderNumber = sanitizeSearchValue(req.params.orderNumber)
        const order = await Order.findOne({
            orderNumber: safeOrderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        if (!order.customer._id.equals(userId)) {
            // Если нет доступа не возвращаем 403, а отдаем 404
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body

        items.forEach((id: Types.ObjectId) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment: sanitizeComment(comment),
            customer: userId,
            deliveryAddress: address,
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const safePayload = sanitizeUpdatePayload(req.body, ['status'])
        const safeOrderNumber = sanitizeSearchValue(req.params.orderNumber)
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: safeOrderNumber },
            safePayload,
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const safeOrderId = sanitizeObjectId(req.params.id, 'orderId')
        const deletedOrder = await Order.findByIdAndDelete(safeOrderId)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
