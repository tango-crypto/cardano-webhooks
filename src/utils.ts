import * as crypto from 'crypto';
import * as cbor from 'borc';
import { WebhookMessage } from './models/webhook-message.model';
import { ClientKafka, KafkaContext } from '@nestjs/microservices';
import { Producer } from 'kafkajs';

const apiVersion = process.env.API_VERSION || 'v1';

const CIP68_STANDARD = {
	'000de140': 222, // NFT Token
	'0014de40': 333, // FT token
	'000643b0': 100// REFERENCE Token
}

export const Utils = {
	groupBy: function (records, property) {
		return records.reduce((dict, item) => {
			const value = item[property];
			dict[value] = (dict[value] || []).concat(item);
			return dict;
		}, {})
	},

	sleep: function (ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	},

	uniqBy: function (a, key) {
		var seen = {};
		return a.filter(function (item) {
			var k = item[key];
			if (!seen[k]) {
				return seen[k] = true;
			}
			return false;
		})
	},

	filterRules: function (rules, items) {
		return items.filter(obj => this.matchRules(rules, obj));
	},

	matchRules: function (rules, obj) {
		return rules.every(r => {
			let value = obj;
			const fields = r.field.split('.');
			for (let i = 0; i < fields.length; i++) {
				const field = fields[i];
				value = value[field];
				if (value == undefined) break;
			}
			return value != undefined && operators[r.operator](value, r.value);
		});
	},

    cborEncode: function (data: any): Buffer {
        return cbor.encode(data);
    },

    cborDecode: function (encoded: string | Buffer): any {
        return cbor.decode(encoded);
    },

    getRandomUUID: function(): string {
        return crypto.randomUUID();
    },

	processWebhook: async function (messageBroker, webhook, eventType, data, confirmations = 0) {
		const key = webhook.webhook_id;
		const accountId = webhook.user_id;
		const authToken = webhook.auth_token;
		const callbackUrl = webhook.callback_url;
		const name = webhook.name;
		const time = Date.now();
        const eventKey = Utils.getRandomUUID();
		const payload = Utils.cborEncode({
			id:  Utils.getRandomUUID(),
			api_version: apiVersion,
			webhook_id: key,
			idempotency_key: `${eventKey}|${key}`,
			object: 'event',
			create_date: time,
			type: eventType,
			data: data
		});

		// send message
		const message: WebhookMessage = {
            webhookId: key,
            accountId,
            webhookName: name,
            authToken,
            callbackUrl,
            payload: payload.toString('base64'),
            type: eventType,
            network: webhook.network,
            confirmations,
        };

		Utils.publishEvent(messageBroker, `wbh_event`, `${accountId}-${webhook.network}`, message);
	},

    publishEvent(kafkaClient: ClientKafka, topic: string, key: string, message: any, headers: {[key: string]: string | Buffer} = {}) {
		console.log('Publish with key:', key);
        kafkaClient.emit(topic, {
            headers,
            key,
            value: message
        });
    },

    commitOffsets(_kafkaClient: ClientKafka, context: KafkaContext): Promise<void> {
        const { offset } = context.getMessage();
        const partition = context.getPartition();
        const topic = context.getTopic();
		const nextOffset = (parseInt(offset, 10) + 1).toString();
        return context.getConsumer().commitOffsets([{ topic, partition, offset: nextOffset }]);
    },

	buildSignature: function (payload, authToken) {
		const hmac = crypto.createHmac('sha256', authToken) // Create a HMAC SHA256 hash using the auth token
		hmac.update(JSON.stringify(payload), 'utf8') // Update the token hash with the request body using utf8
		return hmac.digest('hex');
	},

	assetBalance: function (inputs, outputs) {
		let balance = reduceAssetsQuantity(outputs);
		return reduceAssetsQuantity(inputs, balance, -1);
	},

	assetBalanceWithMint: function (mint, outputs) {
		const balance = reduceAssetsQuantity(outputs);
		return Object.entries<any>(mint).reduce((acc, [fingerprint, asset]) => {
			if (!acc[fingerprint]) { // burn input asset completly (no UTxO with the remaining asset)
				acc[fingerprint] = { ...asset, fingerprint, quantity: 0 };
			}
			return acc;
		}, balance);
	},

	getCIP68TokenStandard: function(prefix) {
		return CIP68_STANDARD[prefix];
	},

	convertDatumToMetadata(datum, policy_id, asset_name, asset_name_label) {
		let json;
		try {
			const [metadata, version] = datum.fields;
			json = {
				[policy_id]: {
					[asset_name]: metadata
				}, 
				version
			}
		} catch (err) {
			// TODO: parse datum for integer overflow
			json = datum?.fields
			console.error(err);
		}
		return {
			label: asset_name_label.toString(),
			json
		}
	}

}

const reduceAssetsQuantity = function (assets, dict = {}, sign = 1) {
	return assets.reduce((acc, cur) => {
		const { fingerprint, quantity, owner, ...props } = cur;
		const q = sign * Number(quantity);
		if (!acc[fingerprint]) {
			acc[fingerprint] = { ...props, fingerprint, quantity: q, owners: { [owner]: Math.abs(q) } };
		} else {
			acc[fingerprint].quantity += q;
			acc[fingerprint].owners[owner] = (acc[fingerprint].owners[owner] || 0) + Math.abs(q);
		}
		return acc;
	}, dict)
}

const operators = {
	'eq': (a, b) => a == b,
	'=': (a, b) => a == b,
	'!=': (a, b) => a != b,
	'>=': (a, b, number = true) => number ? Number(a) >= Number(b) : a >= b,
	'<=': (a, b, number = true) => number ? Number(a) <= Number(b) : a <= b,
	'>': (a, b, number = true) => number ? Number(a) > Number(b) : a > b,
	'<': (a, b, number = true) => number ? Number(a) < Number(b) : a < b,
}