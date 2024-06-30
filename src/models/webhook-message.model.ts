export class WebhookMessage {
    webhookId: string;
    accountId: string;
    webhookName: string;
    authToken: string;
    callbackUrl: string;
    payload: string;
    type: string;
    network: string;
    confirmations: number;
    originalConfirmations?: number;
}