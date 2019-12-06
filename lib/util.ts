export const MINUTES = 60;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;

export function unix() {
  return new Date().getTime() / 1000
}

export function jwtExpired(token: string) {
  if (!token) {
    return true
  }

  try {
    let jwt = JSON.parse(atob(token.split(".")[1]));
    return jwt.exp < unix() - 15 * MINUTES
  } catch (error) {
    return true
  }
}
