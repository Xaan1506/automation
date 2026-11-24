import { DEFAULT_NEWTON_BASE_URL } from './newton-defaults';

export { DEFAULT_NEWTON_BASE_URL };

export const NEWTON_BASE_URL = (
  process.env.NEWTON_BASE_URL?.trim() || DEFAULT_NEWTON_BASE_URL
).replace(/\/+$/, '');

export const NEWTON_LOGIN_URL = (
  process.env.NEWTON_LOGIN_URL?.trim() || `${NEWTON_BASE_URL}/login`
);

export const NEWTON_COURSE_URL = process.env.NEWTON_COURSE_URL?.trim() || '';

export function getNewtonCourseUrl(): URL {
  if (!NEWTON_COURSE_URL) {
    throw new Error('NEWTON_COURSE_URL must point to an enrolled Newton course dashboard.');
  }

  let courseUrl: URL;
  try {
    courseUrl = new URL(NEWTON_COURSE_URL);
  } catch {
    throw new Error('NEWTON_COURSE_URL must be an absolute HTTPS Newton course URL.');
  }

  if (
    courseUrl.protocol !== 'https:' ||
    courseUrl.origin !== new URL(NEWTON_BASE_URL).origin ||
    !/^\/course\/[^/]+\/details\/?$/.test(courseUrl.pathname)
  ) {
    throw new Error('NEWTON_COURSE_URL must use NEWTON_BASE_URL and point to a course details page.');
  }

  return courseUrl;
}

export function resolveNewtonUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, `${NEWTON_BASE_URL}/`).toString();
}
