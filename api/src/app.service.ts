import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'fleet-enterprise-api',
      version: '0.1.0',
      docs: 'GCP-ready API shell (NestJS)',
    };
  }
}
