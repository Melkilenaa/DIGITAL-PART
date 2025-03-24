/**
 * Custom exception classes for standardized error handling across the application
 */

export class BaseException extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestException extends BaseException {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadRequestException';
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends BaseException {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenException';
  }
}

export class NotFoundException extends BaseException {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundException';
  }
}

export class ConflictException extends BaseException {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictException';
  }
}

export class InternalServerErrorException extends BaseException {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500);
    this.name = 'InternalServerErrorException';
  }
}

/**
 * Helper function to handle common database errors and convert them to appropriate exceptions
 */
export function handleDatabaseError(error: any): never {
  // Handle Prisma-specific errors
  if (error.code) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        throw new ConflictException(`Duplicate entry: ${error.meta?.target || 'Unknown field'}`);
      case 'P2003': // Foreign key constraint failure
        throw new BadRequestException(`Related record not found: ${error.meta?.field_name || 'Unknown field'}`);
      case 'P2025': // Record not found
        throw new NotFoundException(error.meta?.cause || 'Record not found');
    }
  }
  
  // Re-throw the original error with a generic message if it's not handled above
  throw new InternalServerErrorException(`Database error: ${error.message}`);
}