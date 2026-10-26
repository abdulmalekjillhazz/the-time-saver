import { describe, expect, it } from 'vitest';
import { adminRouter } from '../../src/routes/admin.js';

describe('admin daily story routes', () => {
  it('registers regeneration and narration endpoints when the router is created', () => {
    const router = adminRouter({});
    const routes = router.stack
      .filter((layer) => layer.route)
      .map(({ route }) => ({
        path: route.path,
        methods: route.methods,
      }));

    expect(routes).toContainEqual({
      path: '/daily-lessons/:id/regenerate',
      methods: expect.objectContaining({ post: true }),
    });
    expect(routes).toContainEqual({
      path: '/daily-lessons/:id/narration',
      methods: expect.objectContaining({ post: true }),
    });
    expect(routes).toContainEqual({
      path: '/notifications/broadcast',
      methods: expect.objectContaining({ get: true }),
    });
    expect(routes).toContainEqual({
      path: '/notifications/broadcast',
      methods: expect.objectContaining({ post: true }),
    });
    expect(routes).toContainEqual({
      path: '/users',
      methods: expect.objectContaining({ get: true }),
    });
    expect(routes).toContainEqual({
      path: '/users/:id/restrict',
      methods: expect.objectContaining({ post: true }),
    });
    expect(routes).toContainEqual({
      path: '/users/:id',
      methods: expect.objectContaining({ delete: true }),
    });
  });
});
