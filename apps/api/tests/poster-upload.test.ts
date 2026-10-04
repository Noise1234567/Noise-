import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { FakeImageStorage, type ImageStorage } from '../src/modules/uploads/image-storage.js';
import { MAX_POSTER_BYTES } from '../src/modules/uploads/poster-file.js';
import { posterUpload } from '../src/modules/uploads/poster-upload.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

/** Application de test : la route définitive (auth, propriété) arrive avec NOISE-011. */
function buildApp(storage: ImageStorage = new FakeImageStorage()) {
  const app = express();
  app.post('/events/:id/poster', ...posterUpload(storage), (_req, res) => {
    res.status(201).json({ posterUrl: res.locals.poster.url });
  });
  app.use(errorHandler);
  return app;
}

describe('envoi d’une affiche', () => {
  it('accepte un JPEG et renvoie l’URL optimisée', async () => {
    const storage = new FakeImageStorage();
    const res = await request(buildApp(storage))
      .post('/events/event-1/poster')
      .attach('poster', JPEG, { filename: 'affiche.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.posterUrl).toContain('w_1080');
    expect(storage.uploads).toEqual([{ eventId: 'event-1', size: JPEG.length }]);
  });

  it('se fie au contenu, pas au nom : un PNG nommé .jpg est accepté', async () => {
    const res = await request(buildApp())
      .post('/events/event-1/poster')
      .attach('poster', PNG, { filename: 'affiche.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
  });

  it('refuse un fichier qui n’est pas une image, même nommé .jpg', async () => {
    const storage = new FakeImageStorage();
    const res = await request(buildApp(storage))
      .post('/events/event-1/poster')
      .attach('poster', Buffer.from('<?php echo 1; ?>'), {
        filename: 'affiche.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/JPEG, PNG ou WebP/);
    expect(storage.uploads).toHaveLength(0);
  });

  it('refuse un fichier de plus de 5 Mo', async () => {
    const tooBig = Buffer.concat([JPEG, Buffer.alloc(MAX_POSTER_BYTES)]);
    const res = await request(buildApp())
      .post('/events/event-1/poster')
      .attach('poster', tooBig, { filename: 'grosse.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/5 Mo/);
  });

  it('refuse une requête sans fichier', async () => {
    const res = await request(buildApp()).post('/events/event-1/poster').field('titre', 'x');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Aucune affiche/);
  });

  it('refuse un fichier envoyé sous un autre nom de champ', async () => {
    const res = await request(buildApp())
      .post('/events/event-1/poster')
      .attach('image', JPEG, { filename: 'affiche.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('renvoie une erreur interne générique si le stockage échoue', async () => {
    const failing: ImageStorage = {
      uploadPoster: async () => {
        throw new Error('Cloudinary indisponible');
      },
    };
    const res = await request(buildApp(failing))
      .post('/events/event-1/poster')
      .attach('poster', JPEG, { filename: 'affiche.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Erreur interne' });
  });
});
