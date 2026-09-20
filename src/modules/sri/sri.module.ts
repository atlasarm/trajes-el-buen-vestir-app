import { Module } from '@nestjs/common';
import { SriService } from './sri.service';

@Module({
    providers: [SriService],
    exports: [SriService]
})
export class SriModule { }