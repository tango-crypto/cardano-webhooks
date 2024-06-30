export class Rule {
    field: string;
    operator: string;
    value: string
}

export const ruleFieldTypes = {
    'policy_id': 'string',
    'asset_name': 'string',
    'fingerprint': 'string',
    'value': 'number',
    'quantity': 'number',
    'tx_count': 'number',
    'out_sum': 'number',
    'fees': 'number',
    'block_no': 'number',
    'pool.ticker': 'string',
    'pool.pool_id': 'string',
    'size': 'number',
    'fee': 'number',
    'no': 'number',
    'nft_minted': 'number',
    'ft_minted': 'number'
}

export const operatorMapping: {[key: string]: string[] } = {
    'string': ['=', '!='],
    'number': ['=', '!=', '>', '<', '>=', '<='],
    'boolean': ['=', '!=']
}