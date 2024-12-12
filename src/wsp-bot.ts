import { Client, LocalAuth } from "whatsapp-web.js";
import * as path from "path"
import * as fs from "fs/promises"
import { BindedDelivery } from "./types";

async function getClient (clientId: string) {
    let dir = path.join("clients", clientId)
    try {
        await fs.access(dir, fs.constants.F_OK)
        console.log("Client", clientId, "at", dir)
    } catch {
        console.log("Client", clientId, "was not found.")
        return null
    }
    return new Client({
        authStrategy: new LocalAuth({
            clientId,
            dataPath: path.join(path.dirname(__dirname), dir)
        })
    })
}

async function createClient (clientId: string) {
    let dir = path.join("clients", clientId)
    let ifExists = await getClient(clientId)
    if (ifExists) return ifExists
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        console.log("ERROR CREATING CLIENT: ", err)
    }

    let client = new Client({
        authStrategy: new LocalAuth({
            clientId,
            dataPath: path.join(path.dirname(__dirname), dir)
        })
    });

    return client
}

async function initClient (client: Client, delivery: BindedDelivery, phoneNumber?:string) {
    client.addListener("loading_screen", () => {
        delivery.show("Preparing the spaceship...");
        console.log("Loading...")
    });
    client.addListener("authenticated", () => {
        delivery.show("Everyone on board...");
        console.log("Succesfully Authenticated.")
    });
    client.addListener("auth_failure", (err) => {
        delivery.show("Oh no, something wrong happened!");
        console.log("Authentication failure: ", err)
    })
    client.addListener("ready", delivery.ready)
    client.addListener("message", (msj) => delivery.onMessage(msj))
    
    try {
        await client.initialize()
        if (phoneNumber) {
            let pairingCode = await client.requestPairingCode(phoneNumber, true);
            delivery.sendCode(pairingCode)
        }
    } catch (err) {
        console.log("Error at initClient:", err)
    }

    return client
}

export {
    getClient,
    createClient,
    initClient
}