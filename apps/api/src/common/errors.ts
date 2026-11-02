import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiException extends HttpException {
  constructor(statusCode: HttpStatus, code: string, message: string) {
    super({ statusCode, code, message }, statusCode);
  }
}
