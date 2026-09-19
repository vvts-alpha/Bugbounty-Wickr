import * as wickrMessageProtos from '@amzn/wickr-messaging-protocol-proto';
import { Logger } from '../logger';

const logger = new Logger('protobuf');

// Protobufs defined at:
// https://code.amazon.com/packages/WickrCrossPlatformMessagingProtocol/trees/mainline

// Export all so they are all included
export const protos = wickrMessageProtos;

export function lookupProtobuf(name: string) {
  if (name in wickrMessageProtos) {
    // eslint-disable-next-line import/namespace
    return wickrMessageProtos[name as keyof typeof wickrMessageProtos];
  }
  return undefined;
}

// This can probably go away, but I was having some issues making
// sure all the protobufs were available. This is just in case
export async function checkProtobufsExist() {
  const MC = lookupProtobuf('MessageCollection');
  if (!MC) {
    const msg = 'protobuf is missing MessageCollection';
    logger.error(msg);
    if (__DEV__) throw new Error(msg);
    return false;
  }
  return true;
}
