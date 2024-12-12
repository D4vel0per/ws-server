import { Client } from "whatsapp-web.js";
import { BasicStatus, BindedDelivery, ClientId, Delivery, SenderCargo, SenderPkg, SenderResponse, simpleMessage } from "./types";
import { createClient, getClient, initClient } from "./wsp-bot";
import { WebSocket } from "ws";

class Storage {
    static sockets:Record<ClientId, WebSocket> = {};
    static clients:Record<ClientId, Client> = {};

    static getClientByPhoneNumber (phoneNumber: string) {
        let twoValueClients = Object.entries(Storage.clients)
        .reduce<Client|null>((val, entry) => {
            let [ ,client ] = entry;
            let clientNumber = client.info.wid.user;
            return clientNumber === phoneNumber ? client : val;
        }, null)
        return twoValueClients;
    }
}

const delivery: Delivery = {
    show (clientId: ClientId, pkg: string) {
        console.log(`${clientId} -> Showing Status: `, pkg)
        deliver(SenderCargo.STATE, pkg, clientId)
    },
    sendCode (clientId: ClientId, pkg: string) {
        console.log(`${clientId} -> Sending Code: `, pkg)
        deliver(SenderCargo.PAIRING_CODE, pkg, clientId)
    },
    onMessage (clientId: ClientId, pkg: simpleMessage) {
        console.log(`${clientId} -> Message Received: `, pkg.body)
        deliver(SenderCargo.MESSAGE, pkg, clientId)
    },
    ready (clientId: ClientId) {
        console.log(`${clientId} -> Everything up and running... Ready to receive messages.`)
        deliver(SenderCargo.STATE, "Everything up and running... Ready to receive messages.", clientId)
    }
}

async function init (socket: WebSocket, clientId: ClientId, phoneNumber?:string) {
    Storage.sockets[clientId] = socket;
    let client:Client|null;

    if (Storage.clients[clientId]) await Storage.clients[clientId].destroy()

    if (phoneNumber) {
        console.log("Creating client...")
        client = await createClient(clientId)
    } else {
        client = await getClient(clientId)
    }

    if (client) {
        console.log("Initialazing client...")
        client = await initClient(client, createDelivery(clientId), phoneNumber)
        console.log("Client ", clientId, "initialized")
        Storage.clients[clientId] = client;
        return BasicStatus.SUCCESS;
    } else {
        console.log("Error initialazing ", clientId, " client")
        return BasicStatus.FAILED;
    }
}

function createDelivery (clientId: ClientId) {
    let newDelivery: BindedDelivery = {
        show: delivery.show.bind(null, clientId),
        sendCode: delivery.sendCode.bind(null, clientId),
        onMessage: delivery.onMessage.bind(null, clientId),
        ready: delivery.ready.bind(null, clientId)
    };
    return newDelivery
}

async function deliver (cargo: SenderCargo, pkg: SenderPkg, clientId: ClientId) {
    if (!Storage.clients[clientId]) {
        console.log("Error: Client is null");
        return;
    }
    console.log("DELIVERING ", cargo);
    const { STATE, PAIRING_CODE, MESSAGE } = SenderCargo
    let response: SenderResponse = {
        type: cargo,
        data: "",
        from: Storage.clients[clientId].info?.wid.user,
        status: BasicStatus.SUCCESS
    }

    switch (cargo) {
        case PAIRING_CODE:
        case STATE: { // Just a state for the client to see...
            response.data = pkg as string
        } break;
        case MESSAGE: {
            pkg = pkg as simpleMessage
            if (pkg.isStatus) return;
            response.data = JSON.stringify(pkg)
            try {
                console.log("Received: " + pkg.body)
                await Storage.clients[clientId].sendMessage(
                    pkg.from, "Received: " + pkg.body
                )
            } catch (err) {
                console.log("ERROR:", err)
                response.status = BasicStatus.FAILED
            }
        }
    }
    Storage.sockets[clientId].send(JSON.stringify(response))
}

export {
    init,
    deliver,
    Storage
}