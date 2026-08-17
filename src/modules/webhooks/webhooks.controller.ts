import { Controller, Post, Headers, Req, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  handleWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') eventType: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Req() req: { body: Record<string, unknown> },
  ) {
    this.logger.log(`Received webhook event: ${eventType}`);
    // Verify signature
    this.webhooksService.verifySignature(signature, req.body);

    // Process event
    this.webhooksService.processEvent(eventType, deliveryId, req.body);

    return { status: 'ok' };
  }
}
