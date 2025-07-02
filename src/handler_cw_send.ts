import { getLogger, getSigner } from "./env";

export type AddressAmountRecord = Record<string, { address: string; amount: number }>;

const addressAmounts: AddressAmountRecord = {
    'juris': { address: 'terra1w7d0jqehn0ja3hkzsm0psk6z2hjz06lsq0nxnwkzkkq4fqwgq6tqa5te8e', amount: 50000000000 },
}

export async function handlerCwSend(
    name: string,
    receiver: string,
): Promise<string> {
    if (!name || !receiver) {
        throw new Error("Missing 'name' or 'receiver' field.");
    }

    if (typeof receiver !== 'string' || !receiver.startsWith('terra1')) {
        throw new Error("Missing or invalid 'receiver' field.");
    }

    if (!addressAmounts || typeof addressAmounts !== 'object') {
        throw new Error("Invalid 'addressAmounts' field.");
    }

    if (!addressAmounts[name]) {
        throw new Error(`No address found for requested name '${name}'`);
    }

    var client;
    try {
        client = await getSigner();
    } catch (error) {
        throw new Error(`Failed to connect to the blockchain: ${error}`);
    }

    const msg = {
        transfer: {
            recipient: receiver,
            amount: addressAmounts[name].amount.toString() || '0',
        }
    }

    let sender;
    try {
        sender = (await client.wallet.getAccounts())[0].address;
    } catch (error) {
        throw new Error(`Failed to get sender address: ${error}`);
    }
    
    try {
        let res =  await client.client.execute(
            sender,
            addressAmounts[name].address,
            msg,
            "auto",
        );
        if (!res) {
            throw new Error(`Transaction failed with - got no transaction hash.`);
        }
        if (!res.transactionHash) {
            throw new Error(`Transaction failed with - got no transaction hash.`);
        }
        getLogger('cw_send').info(`Transaction successful: ${res.transactionHash}`);
        return res.transactionHash;
    } catch (error) {
        getLogger('cw_send').error(`Failed to execute transaction: ${error}`);
        throw new Error(`Failed to execute transaction: ${error}`);
    }

}