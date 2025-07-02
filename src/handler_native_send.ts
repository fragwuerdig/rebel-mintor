import { coin } from "@cosmjs/stargate";
import { getSigner } from "./env";

export type AddressAmountRecord = Record<string, { denom: string; amount: number }>;

const addressAmounts: AddressAmountRecord = {
    'lunc': { denom: 'uluna', amount: 50250000000 },
}

export async function handlerNativeSend(
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

    let sender;
    try {
        sender = (await client.wallet.getAccounts())[0].address;
    } catch (error) {
        throw new Error(`Failed to get sender address: ${error}`);
    }
    
    try {
        let res =  await client.client.sendTokens(
            sender,
            receiver,
            [coin(addressAmounts[name].amount, addressAmounts[name].denom)],
            "auto",
        );
        if (!res) {
            throw new Error(`Transaction failed with - got no transaction hash.`);
        }
        if (!res.transactionHash) {
            throw new Error(`Transaction failed with - got no transaction hash.`);
        }
        if (res.code !== 0) {
            throw new Error(`Transaction failed with code ${res.code}: ${res}`);
        }
        console.log(`Transaction successful: ${res.transactionHash}`);
        return res.transactionHash;
    } catch (error) {
        throw new Error(`Failed to execute transaction: ${error}`);
    }

}