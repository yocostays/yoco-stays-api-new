export interface HttpResponse {
    statusCode: number;
    message: string;
    [key: string]: unknown; // Allows for additional dynamic properties
  }