import { TestOption, Wallet } from './types';

console.info('available values for env variables: ');
console.info(
    `- TEST_TYPE:   ${Object.values(TestOption)
        .filter((key) => typeof key == 'string')
        .join(', ')}`
);
console.info(
    `- WALLET_TYPE: ${Object.values(Wallet)
        .filter((key) => typeof key == 'string')
        .join(', ')}`
);
