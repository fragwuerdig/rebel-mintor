import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { stringToPath } from "@cosmjs/crypto";
import dotenv from "dotenv";
import winston from 'winston';

dotenv.config();
const loggerMap: Record<string, winston.Logger> = {};

export const getMnemonic = (): string => {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
        throw new Error("MNEMONIC environment variable is not set.");
    }
    return mnemonic;
};

export const getRpcUrl = (): string => {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
        throw new Error("RPC_URL environment variable is not set.");
    }
    return rpcUrl;
};

export const getSigner = async (): Promise<{ wallet: DirectSecp256k1HdWallet; client: SigningCosmWasmClient }> => {
    const seed = getMnemonic();
    const url = getRpcUrl();
    const path = stringToPath("m/44'/330'/0'/0/0"); // Terra HD path
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        seed,
        { prefix: "terra", hdPaths: [path] }
    );
    const client = await SigningCosmWasmClient.connectWithSigner(
        url,
        wallet,
        { gasPrice: GasPrice.fromString("29uluna") }
    );
    return { wallet, client };
}

export const getLogLevel = (): string => {
    const logLevel = process.env.LOG_LEVEL;
    if (!logLevel) {
        return 'info'; // Default log level
    }
    return logLevel;
};

export function getLogger(name: string) {
    if (loggerMap[name]) {
        return loggerMap[name];
    }
    const logger = winston.createLogger({
        level: getLogLevel(),
        format: winston.format.combine(
            winston.format.label({ label: name }),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, label }) => {
                return `[${timestamp}] [${label}] ${level.toUpperCase()}: ${message}`;
            })
        ),
        transports: [
            new winston.transports.Console()
        ],
    });
    loggerMap[name] = logger;
    return logger;
}

export const getPort = (): number => {
    const port = process.env.PORT;
    if (!port) {
        return 3000;
    }
    const parsedPort = parseInt(port, 10);
    if (isNaN(parsedPort) || parsedPort <= 0) {
        getLogger('env').warn(`Invalid PORT environment variable: ${port} using default port 3000.`);
        return 3000;
    }
    return parsedPort;
};