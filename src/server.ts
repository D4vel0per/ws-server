import express from 'express';
import { RawData, Server, WebSocket } from 'ws'
import { Client } from 'whatsapp-web.js';
import { randomUUID } from 'crypto';
import { 
  formInfo, 
  SenderCargo, 
  SenderInfo,
  BasicStatus,
  ClientId,
  AdapterResponse,
  SenderPkg,
  simpleMessage
} from './types';
import * as Sender from './sender';
import { Storage } from './sender';
import { toChatId, toPhoneNumber } from './utils';

const app = express();
const port = 7162;
const ipAddress = '45.90.12.29';

const server = app.listen(port, () => {
  console.log(`Server is running on http://${ipAddress}:${port}`);
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

function checkPkg (pkg: SenderPkg) {
  if (typeof pkg === "string")
    return SenderCargo.STATE;
  const keys = Object.keys(pkg);
  const simpleMessage = ["from", "body", "isStatus", "to"]
  const formInfo = ["clientId", "phoneNumber"]
  if (keys.every(key => simpleMessage.includes(key)))
    return SenderCargo.MESSAGE
  if (keys.every(key => formInfo.includes(key)))
    return SenderCargo.FORM

  return pkg
}

async function proccessForm (pkg: formInfo, socket: WebSocket) {
  console.log("Package will be used as Form Data:", pkg)

  const checkedId = (

    (clientId: string) => {
      let result = clientId || randomUUID().split("-")[0];

      if (!clientId.endsWith("_client")) 
        result = clientId + "_client"
        return result as ClientId

    }

  )(pkg.clientId)

  let status = await Sender.init(
    socket, 
    checkedId, 
    pkg.phoneNumber
  );

  return {
    status,
    checkedId
  }
}

async function processMessage(pkg: simpleMessage) {
  console.log("Package will be used as Message Data:", pkg)

  pkg.from = toPhoneNumber(pkg.from) || pkg.from
  pkg.to = toChatId(pkg.to) || pkg.to
  let client = null;
  if (pkg.from)
    client = Storage.getClientByPhoneNumber(pkg.from);
  else {
    console.log("Invalid 'from' number: ", pkg.from);
  }
  
  let status = BasicStatus.FAILED;
  if (client && pkg.to) {
    try {
      await client.sendMessage(pkg.to, pkg.body);
      status = BasicStatus.SUCCESS;
    } catch (err) {
      console.log("Error in processMessage(): ", err);
    }
  } else {
    console.log("Got a problem in proccessMessage():")
    console.log(client ? `pkg.to is invalid: ${pkg.to}` : "Client is null")
  }
  return {
    status,
    client
  }
}

async function adapt (msj: RawData, socket: WebSocket): Promise<AdapterResponse> {
  console.log("Reading client data");
  let clientData: SenderInfo = JSON.parse(msj.toString())
  let pkg = clientData.package

  let client:Client|null = null;
  let status = BasicStatus.FAILED

  if (clientData.cargo !== checkPkg(pkg)) {
    console.log(
      "Package is not the same as the cargo type.\n",
      `Type of cargo: ${clientData.cargo}\n`,
      `Type of package:`, checkPkg(pkg)
    )
    return {
      status,
      user: undefined
    }
  }
  switch (clientData.cargo) {
    case SenderCargo.FORM: {
      pkg = pkg as formInfo;

      let processed = await proccessForm(pkg, socket)

      status = processed.status;
      client = Storage.clients[processed.checkedId];
    } break;
    case SenderCargo.MESSAGE: {
      pkg = pkg as simpleMessage;
      let processed = await processMessage(pkg)

      status = processed.status;
      client = processed.client;
    }
  }
  
  return {
    status,
    user: client?.info?.wid.user
  }
}

let form: SenderInfo = {
  cargo: SenderCargo.FORM,
  package: {
    clientId: "client_1",
    phoneNumber: "584146715394"
  }
}

let message: SenderInfo = {
  cargo: SenderCargo.MESSAGE,
  package: {
    from: "584146715394@c.us",
    to: "584121108553@c.us",
    body: "HIIIII",
    isStatus: false
  }
}

console.log(JSON.stringify(form))
console.log(JSON.stringify(message))