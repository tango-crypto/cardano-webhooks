import { Rule } from "./rule.model";

export type WebhookKey = 'WBH_EPOCH' | 'WBH_BLOCK' | 'WBH_DELEGATION' | 'WBH_PAYMENT' | 'WBH_ASSET' | 'WBH_TRANSACTION'; 

export class Webhook {
    user_id: string;
    webhook_id: string; 
    webhook_key: WebhookKey; 
    name: string;
    network: string;
    description: string;
    callback_url: string;
    auth_token: string;
    last_trigger_date: Date | string;
    rules?: Rule[];
    create_date: Date | string;
    update_date: Date | string;
    type: string;
    active: boolean;
    confirmations: number;
}

export const webhookTypes = ['payment', 'epoch', 'block', 'delegation', 'transaction', 'asset', 'nft_api'];