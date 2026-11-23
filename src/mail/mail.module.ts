import { Global, Module } from '@nestjs/common';

import { MailRenderer } from './mail.renderer';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [{ provide: MailRenderer, useFactory: () => new MailRenderer() }, MailService],
  exports: [MailService],
})
export class MailModule {}
