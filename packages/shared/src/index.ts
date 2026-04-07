export interface IUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export const API_URL = 'http://localhost:3000';