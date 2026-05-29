import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerEntity } from './customer.entity';
import { ProjectEntity } from '../project/project.entity';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';

/**
 * Customers / clients — workspace-scoped directory of external parties that
 * projects can be attributed to. Owns the `CustomerEntity` repository plus a
 * reference to `ProjectEntity` so the service can nullify `projects.customer_id`
 * when a customer is soft-deleted (see `CustomerService.softDelete`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity, ProjectEntity])],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
