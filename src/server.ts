import express from 'express';
import { RawData, Server, WebSocket } from 'ws'
import { createClient, formInfo, getClient, initClient, SenderCargo, SenderPkg, simpleMessage } from './wsp-bot';
import { Client } from 'whatsapp-web.js';
import { randomUUID } from 'crypto';

const app = express();
const port = 8000;

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const WS_server = new Server({ server })

WS_server.on("connection", (socket) => {
  console.log("Someone new connected to the server:", socket.url)

  socket.on("message", async (msj: RawData) => {
    console.log("WebSocket Message received: Adapting...")
    let processed = await adapt(msj, socket);
    console.log("Sending Response...")
    socket.send(JSON.stringify(processed))
  })
})

interface SenderInfo<SenderPkg> {
  cargo: SenderCargo,
  package: SenderPkg
}

interface SenderResponse {
  type: SenderCargo,
  data: string,
  from: string,
  status: BasicStatus
}

export interface Delivery {
  show: (clientId: ClientId, pkg: string) => void,
  sendCode: (clientId: ClientId, pkg: string) => void,
  onMessage: (clientId: ClientId, pkg: simpleMessage) => void,
  ready: (clientId: ClientId) => void
}

export interface BindedDelivery {
  show: (pkg: string) => void,
  sendCode: (pkg: string) => void,
  onMessage: (pkg: simpleMessage) => void,
  ready: () => void
}

enum BasicStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED"
}

type ClientId = `${string}_client`

export class Sender {
  static sockets:Record<ClientId, WebSocket> = {};
  static clients:Record<ClientId, Client> = {};

  static async init (socket: WebSocket, clientId: ClientId, phoneNumber?:string) {
    Sender.sockets[clientId] = socket
    let client:Client|null;

    if (Sender.clients[clientId]) await Sender.clients[clientId].destroy()

    if (phoneNumber) {
      console.log("Creating client...")
      client = await createClient(clientId)
    } else {
      client = await getClient(clientId)
    }
    
    if (client) {
      console.log("Initialazing client...")
      client = await initClient(client, Sender.createDelivery(clientId), phoneNumber)
      console.log("Client ", clientId, "initialized")
      Sender.clients[clientId] = client;
      return BasicStatus.SUCCESS
    } else {
      console.log("Error initialazing ", clientId, " client")
      return BasicStatus.FAILED
    }
  }

  static createDelivery (clientId: ClientId): BindedDelivery {
    let delivery = {
      show: Sender.delivery.show.bind(null, clientId),
      sendCode: Sender.delivery.sendCode.bind(null, clientId),
      onMessage: Sender.delivery.onMessage.bind(null, clientId),
      ready: Sender.delivery.ready.bind(null, clientId)
    };
    return delivery
  }

  static delivery: Delivery = {
    show (clientId: ClientId, pkg: string) {
      console.log(`${clientId} -> Showing Status: `, pkg)
      Sender.deliver(SenderCargo.STATE, pkg, clientId)
    },
    sendCode (clientId: ClientId, pkg: string) {
      console.log(`${clientId} -> Sending Code: `, pkg)
      Sender.deliver(SenderCargo.PAIRING_CODE, pkg, clientId)
    },
    onMessage (clientId: ClientId, pkg: simpleMessage) {
      console.log(`${clientId} -> Message Received: `, pkg.body)
      Sender.deliver(SenderCargo.MESSAGE, pkg, clientId)
    },
    ready (clientId: ClientId) {
      console.log(`${clientId} -> Everything up and running... Ready to receive messages.`)
      Sender.deliver(SenderCargo.STATE, "Everything up and running... Ready to receive messages.", clientId)
    }
  }

  static async deliver (cargo: SenderCargo, pkg: SenderPkg, clientId: ClientId) {
    if (!Sender.clients[clientId]) {
      console.log("Error: Client is null");
      return
    }
    console.log("DELIVERING ", cargo)
    const { STATE, PAIRING_CODE, MESSAGE } = SenderCargo
    let response: SenderResponse = {
      type: cargo,
      data: "",
      from: Sender.clients[clientId].info?.wid.user,
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
          await Sender.clients[clientId].sendMessage(pkg.from, "Received: " + pkg.body)
        } catch (err) {
          console.log("ERROR:", err)
          response.status = BasicStatus.FAILED
        }
      }
    }
    Sender.sockets[clientId].send(JSON.stringify(response))
  }
}

interface AdapterResponse {
  status: BasicStatus
  user: string | undefined
}

async function adapt (msj: RawData, socket: WebSocket): Promise<AdapterResponse> {
  console.log("Reading client data");
  let clientData: SenderInfo<formInfo> = JSON.parse(msj.toString())
  let isForm = clientData.cargo === SenderCargo.FORM;
  let pkg = clientData.package
  let client:Client|null = null;
  let status = BasicStatus.FAILED
  if (isForm) {
    console.log("Package will be used as Form Data:", pkg)
    const checkedId = (
      (clientId: string): ClientId => {
        let result = clientId || randomUUID().split("-")[0];
        if (!clientId.endsWith("_client")) 
          result = clientId + "_client"
        
        return result as ClientId
      }
    )(pkg.clientId)

    status = await Sender.init(
      socket, 
      checkedId, 
      pkg.phoneNumber
    );

    client = Sender.clients[checkedId]
  }
  
  return {
    status,
    user: client?.info?.wid.user
  }
}

let message: SenderInfo<formInfo> = {
  cargo: SenderCargo.FORM,
  package: {
    clientId: "client_1",
    phoneNumber: "584146715394"
  }
}

console.log(JSON.stringify(message))