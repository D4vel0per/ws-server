import { Client, LocalAuth } from "whatsapp-web.js";
import * as path from "path"
import * as fs from "fs"
import { BindedDelivery, Delivery } from "./server";

const afs = fs.promises

async function getClient (clientId: string) {
    let dir = path.join("clients", clientId)
    try {
        await afs.access(dir, fs.constants.F_OK)
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
        await afs.mkdir(dir, { recursive: true });
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

enum SenderCargo {
    STATE = "State",
    PAIRING_CODE = "PCode",
    MESSAGE = "Message",
    FORM = "Form"
}

type simpleMessage = {
    from: string,
    body: string,
    isStatus: boolean
}

type formInfo = {
    clientId: string,
    phoneNumber?: string
}

type SenderPkg = string|simpleMessage|formInfo

type expoSender = (client:Client, cargo: SenderCargo, pkg: SenderPkg) => any

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

    client.initialize()
    .then(async () => {
        if (phoneNumber) {
            let pairingCode = await client.requestPairingCode(phoneNumber, true);
            delivery.sendCode(pairingCode)
        }
    }).catch(err => console.log("Error at initClient:", err))

    return client
    
}
/*
async function runClients (
    delivery: Delivery
) {
    let clientNames = await afs.readdir("clients")
    let proms = clientNames.map(async clientName => {
        let client = await initClient(clientName, delivery)
        return {
            client,
            name: clientName
        }
    })

    let results = await Promise.allSettled(proms)
    let initialValue: {
        accepted: Client[],
        rejected: string[]
    } = {
        accepted: [],
        rejected: []
    }
    let allClients = results.reduce((obj, result) => {
        if (result.status === "fulfilled") {
            if (result.value.client) 
                obj.accepted.push(result.value.client)
            else 
                obj.rejected.push(result.value.name)
        } else if (result.status === "rejected") {
            console.log(result.reason)
        }
        return obj
    }, initialValue)

    return allClients
}

//HOW TO USE

//FIRST OF ALL, YOU NEED TO HAVE AT LEAST 1 CLIENT FOR THIS FUNCTION TO WORK PROPERLY
//THE CLIENT ID MUST BE THEIR PHONE NUMBER FOR EASIER 
*/
export {
    expoSender,
    SenderCargo,
    SenderPkg,
    formInfo,
    simpleMessage,
    getClient,
    createClient,
    initClient
}