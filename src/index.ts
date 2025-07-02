import express, { Request, Response } from 'express';
import { handlerCwSend } from './handler_cw_send';
import { handlerNativeSend } from './handler_native_send';
import { getLogger, getPort, getSigner } from './env';
import cors from 'cors';

const app = express();
const port = getPort();

app.set('trust proxy', true);
app.use(express.json());
app.use(cors());

const ipTimestamps = new Map<string, number>();
const addressTimestamps = new Map<string, number>();

const waitTxInclusion = async (txHash: string): Promise<boolean> => {
    
    let client = (await getSigner()).client;
    
    for (let i = 0; i < 6; i++) {
        try {
            const tx = await client.getTx(txHash);
            if (tx) {
                getLogger('server').info(`Transaction ${txHash} included in block ${tx.height}`);
                return true;
            }
        } catch (error) {
            getLogger('server').error(`Error fetching transaction ${txHash}:`, error);
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    return false;

}

const handlers: Record<string, (name: string, receiver: string) => Promise<string>> = {
    gold: async (name, receiver) => {
        getLogger('server').info(`Minting ${name} to ${receiver}`);
        return "gold";
    },
    silver: async (name, receiver) => {
        getLogger('server').info(`Minting ${name} to ${receiver}`);
        return "silver";
    },
    juris: handlerCwSend,
    lunc: handlerNativeSend,
};

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

app.post('/v1/mint/:name', async (req: Request, res: Response): Promise<void> => {
    const name = req.params.name;
    const receiver = req.body.receiver;
    const clientIp = req.ip;

    if (!name || !receiver) {
        res.status(400).json({ error: "Missing 'name' or 'receiver' field." });
        return;
    }

    // Validate clientIp is a valid IPv4 or IPv6 address
    const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([a-fA-F0-9:]+:+)+[a-fA-F0-9]+$/;
    if (!clientIp || (!ipv4Regex.test(clientIp) && !ipv6Regex.test(clientIp))) {
        res.status(400).json({ error: "Invalid client IP address." });
        return;
    }

    if (typeof receiver !== 'string' || !receiver.startsWith('terra1')) {
        res.status(400).json({ error: "Missing or invalid 'receiver' field." });
        return;
    }

    const handler = handlers[name];
    if (!handler) {
        res.status(404).json({ error: `No handler for '${name}'` });
        return;
    }

    const ipKey = `${name}:${clientIp}`;
    const addressKey = `${name}:${receiver}`;

    const now = Date.now();

    if (ipTimestamps.has(ipKey) && now - ipTimestamps.get(ipKey)! < RATE_LIMIT_MS) {
        res.status(429).json({ error: "Rate limit exceeded for this IP. Try again later." });
        return;
    }

    if (addressTimestamps.has(addressKey) && now - addressTimestamps.get(addressKey)! < RATE_LIMIT_MS) {
        res.status(429).json({ error: "Rate limit exceeded for this address. Try again later." });
        return;
    }

    try {
        handler(name, receiver).then(async (hash: string) => {
            getLogger('server').info(`Mint request for ${name} to ${receiver} accepted. Transaction hash: ${hash}`);
            try {
                let included = await waitTxInclusion(hash);
                if (!included) {
                    getLogger('server').error(`Transaction ${hash} was not included in a block.`);
                    ipTimestamps.delete(ipKey);
                    addressTimestamps.delete(addressKey);
                }
            } catch (error) {
                getLogger('server').error(`Error executing mint request for ${name} to ${receiver}:`, error);
                ipTimestamps.delete(ipKey);
                addressTimestamps.delete(addressKey);
            }
        }).catch((error) => {
            getLogger('server').error(`Error processing mint request for ${name} to ${receiver}:`, error);
            ipTimestamps.delete(ipKey);
            addressTimestamps.delete(addressKey);
        });

        // Handler is started asynchronously, so we remain responsive to clients.
        // Lets set the limit guards here to prevent spamming abuse. If the
        // tx turns out to be invalid, the async handler will clean up the limits
        // again.
        ipTimestamps.set(ipKey, now);
        addressTimestamps.set(addressKey, now);

        res.json({ success: true, message: `Mint request for ${receiver} accepted.` });
    } catch (err) {
        getLogger('server').error(err);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.listen(port, () => {
    getLogger('server').info(`Server running on port ${port}`);
});

