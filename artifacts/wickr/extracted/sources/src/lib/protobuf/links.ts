import { LinkCollection } from '@amzn/wickr-messaging-protocol-proto';
import { v4 } from 'uuid';
import { Logger } from '../logger';
import { assertRequiredKeysFactory } from './utils';

export const INVALID_LINK_ITEM = 'Invalid LinkItem';

const logger = new Logger('protobuf/links');

export type RequiredLinkInfo = OptionalExceptForRequiredNonNullable<
  LinkCollection.ILinkItem,
  'id' | 'url'
>;

export type WickrLinkItem = {
  id: string | null;
  url: string | null;
  siteName?: string | null;
  pageTitle?: string | null;
  description?: string | null;
  favIconUrl?: string | null;
  imageUrl?: string | null;
  sentTimestamp?: number | null;
  sentByUser?: string | null;
  savedTimestamp?: number | null;
  savedByUser?: string | null;
};

export const assertRequiredLink = assertRequiredKeysFactory<RequiredLinkInfo>(['id', 'url']);

export const linkItemToWickrLinkItem = (
  linkItem: LinkCollection.ILinkItem
): WickrLinkItem | undefined => {
  try {
    const link = assertRequiredLink(linkItem);
    const {
      id,
      url,
      siteName,
      pageTitle,
      description,
      favIconUrl,
      imageUrl,
      sentTimestamp,
      sentByUser,
      savedTimestamp,
      savedByUser,
    } = link;
    return {
      id,
      url,
      siteName,
      pageTitle,
      description,
      favIconUrl,
      imageUrl,
      sentTimestamp,
      sentByUser,
      savedTimestamp,
      savedByUser,
    };
  } catch (err) {
    if (__DEV__) {
      logger.error(err);
      return {
        id: v4(),
        url: `${INVALID_LINK_ITEM}: ${JSON.stringify(linkItem, undefined, 2)}`,
        siteName: null,
        pageTitle: null,
        description: null,
        favIconUrl: null,
        imageUrl: null,
        sentTimestamp: null,
        sentByUser: null,
        savedTimestamp: null,
        savedByUser: null,
      };
    }
    return undefined;
  }
};

export type LinkCollectionWithMeta = {
  items: WickrLinkItem[];
};

export const linkCollectionToWickrLinkItems = (
  collection: LinkCollection
): LinkCollectionWithMeta => {
  const { linkItems } = collection;
  return {
    items: linkItems
      .map((link) => linkItemToWickrLinkItem(link))
      .filter((link): link is WickrLinkItem => !!link),
  };
};
