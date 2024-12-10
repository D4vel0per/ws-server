import express from 'express';
import { RawData, Server, WebSocket } from 'ws'
import { createClient, formInfo, getClient, initClient, SenderCargo, SenderPkg, simpleMessage } from './wsp-bot';
import { Client } from 'whatsapp-web.js';

const app = express();
const port = 8000;

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const WS_server = new Server({ server })

WS_server.on("connection", (socket) => {
  console.log("Someone new connected to the server")

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
  status: "SUCCESS"|"FAILED"
}

export interface Delivery {
  show: (pkg: string) => void,
  sendCode: (pkg: string) => void,
  onMessage: (pkg: simpleMessage) => void,
  ready: (pkg: string) => void
}

export class Sender {
  static socket:WebSocket|null = null;
  static client:Client|null = null;

  static async init (socket: WebSocket, clientId: string, phoneNumber?:string) {
    Sender.socket = socket;
    let client:Client|null;
    if (phoneNumber) {
      console.log("Creating client...")
      client = await createClient(clientId, phoneNumber, Sender.delivery)
    } else {
      client = await getClient(clientId)
    }

    if (Sender.client) await Sender.client.destroy()
    
    if (client) {
      console.log("Initialazing client...")
      client = await initClient(client, Sender.delivery, phoneNumber)
      console.log("Client ", clientId, "initialized")
      Sender.client = client;
    } else {
      console.log("Error initialazing ", clientId, " client")
    }
  }

  static delivery: Delivery = {
    show (pkg: SenderPkg) {
      console.log("Showing", pkg)
      Sender.deliver(SenderCargo.STATE, pkg)
    },
    sendCode (pkg: SenderPkg) {
      console.log("Sending code", pkg)
      Sender.deliver(SenderCargo.PAIRING_CODE, pkg)
    },
    onMessage (pkg: SenderPkg) {
      console.log("New message")
      Sender.deliver(SenderCargo.MESSAGE, pkg)
    },
    ready () {
      console.log("Everything up and running... Ready to receive messages.")
    }
  }

  static async deliver (cargo: SenderCargo, pkg: SenderPkg) {
    if (!Sender.client) {
      console.log("Error: Client is null");
      return
    }
    console.log("DELIVERING ", cargo)
    const { STATE, PAIRING_CODE, MESSAGE } = SenderCargo
    let response: SenderResponse = {
      type: cargo,
      data: "",
      from: Sender.client.info?.wid.user,
      status: "SUCCESS"
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
          await Sender.client.sendMessage(pkg.from, "Received: " + pkg.body)
        } catch (err) {
          console.log("ERROR:", err)
          response.status = "FAILED"
        }
      }
    }
    Sender.socket?.send(JSON.stringify(response))
  }
}

interface AdapterResponse {
  status: "SUCCESS"|"FAILED"
  user: string | undefined
}

async function adapt (msj: RawData, socket: WebSocket): Promise<AdapterResponse> {
  console.log("Reading client data");
  let clientData: SenderInfo<formInfo> = JSON.parse(msj.toString())
  let isForm = clientData.cargo === SenderCargo.FORM;
  let pkg = clientData.package
  //let client:Client|null = null;

  if (isForm) {
    console.log("Package will be used as Form Data:", pkg)
    //client = await sender.init(socket, pkg.clientId, pkg.phoneNumber);
    await Sender.init(socket, pkg.clientId, pkg.phoneNumber);
  }
  
  return {
    status: Sender.client ? "SUCCESS" : "FAILED",
    user: Sender.client?.info?.wid.user
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