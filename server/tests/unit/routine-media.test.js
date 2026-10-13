import { describe, expect, it } from 'vitest';
import { toRoutineDto } from '../../src/services/dto.js';
import * as shared from '@smart-routine/shared';

const routine = {
  _id: '65f0c0ffee0000000000abcd',
  title: 'Morning walk',
  startTime: '07:00',
  endTime: '07:30',
  category: 'health',
  priority: 'medium',
  media: {
    publicId: 'smart-routine/routines/aB3dE5fG7hJ9',
    resourceType: 'image',
    url: 'https://res.cloudinary.com/demo/image/upload/smart-routine/routines/aB3dE5fG7hJ9',
  },
};

describe('routine media removal', () => {
  it('does not expose legacy media stored on an existing routine', () => {
    const dto = toRoutineDto(routine);
    expect(dto).not.toHaveProperty('media');
    expect(JSON.stringify(dto)).not.toContain('smart-routine/routines/');
  });

  it('does not export a user-routine media mutation schema', () => {
    expect(shared).not.toHaveProperty('attachRoutineMediaSchema');
  });
});
