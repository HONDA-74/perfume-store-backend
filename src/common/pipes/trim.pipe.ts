import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      Object.keys(record).forEach((key) => {
        const fieldValue = record[key];
        if (typeof fieldValue === 'string') {
          record[key] = fieldValue.trim();
        }
      });
    }

    return value;
  }
}
