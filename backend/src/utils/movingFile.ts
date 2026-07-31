import { existsSync, mkdirSync, renameSync } from 'fs';
import { basename, join, resolve } from 'path';

function movingFile(imagePath: string, from: string, to: string) {
    const fileName = basename(imagePath);
    const publicRoot = resolve(__dirname, '../public');
    const safeFrom = resolve(from);
    const safeTo = resolve(to);
    const imagePathTemp = join(safeFrom, fileName);
    const imagePathPermanent = join(safeTo, fileName);

    if (
        safeFrom !== publicRoot &&
        !safeFrom.startsWith(`${publicRoot}/`)
    ) {
        throw new Error('Ошибка при сохранении файла');
    }

    if (safeTo !== publicRoot && !safeTo.startsWith(`${publicRoot}/`)) {
        throw new Error('Ошибка при сохранении файла');
    }

    mkdirSync(safeTo, { recursive: true });
    if (!existsSync(imagePathTemp)) {
        throw new Error('Ошибка при сохранении файла');
    }

    if (!imagePathTemp.startsWith(`${safeFrom}/`)) {
        throw new Error('Ошибка при сохранении файла');
    }

    if (!imagePathPermanent.startsWith(`${safeTo}/`)) {
        throw new Error('Ошибка при сохранении файла');
    }

    renameSync(imagePathTemp, imagePathPermanent);
}

export default movingFile;