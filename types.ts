export interface LinkInfo {
  text: string;
  url: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  links?: LinkInfo[];
  isLoading?: boolean;
}

export interface GeminiResponse {
    responseText: string;
    foundLinks: LinkInfo[];
}

export interface AuthState {
  isLoggedIn: boolean;
  tokens: number;
  userIdentifier: string | null;
  email: string | null;
  payeerWallet: string | null;
}

export interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
}

export interface MockTransaction {
  transactionId: string;
  amount: number;
  userIdentifier: string;
  claimed: boolean;
}

export interface MockEmail {
  id: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
}
