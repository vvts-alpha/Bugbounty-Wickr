import { ConvoCollection } from '@amzn/wickr-messaging-protocol-proto';
import { ConvoMuteOptions } from '@/store/slices/convos';
import { DailyMetric, HourlyMetric } from './summarizers/HourlySummarizer';
import { MemoryUsageAttributes, MemoryUsageMetrics } from './summarizers/memorySummarizer';
import { ResponsivenessMetric } from './summarizers/responsivenessSummarizer';
import { ConvoSwitchEventAttributes, ConvoSwitchEventMetrics } from './trackMetrics';

/**
 * MetricTuple defines the type of the metrics and attributes for each metric.
 * If there are none, it defaults to [never, never]. If there is only one of metrics or
 * attributes, define the missing one as unknown, otherwise the segmentation types break.
 * Note: Metrics are always numeric values, and attributes can be any value.
 *
 * @example
 * // Both defined
 * MetricTuple<YourMetricsType, YourMetricsAttributes>
 *
 * // One defined
 * MetricTuple<YourMetricsType, unknown>
 * MetricTuple<unknown, YourMetricsAttributes>
 *
 * // Do not do this:
 * MetricTuple<YourMetricsType, never>
 *
 */
type MetricTuple<Metric = never, Attribute = never> = [Metric, Attribute];

export type SurveyMetricAttributes = {
  app_name: string;
  app_version: string;
  os: string;
  platform: string;
  webViewVersion: string;
  widget_id: string;
} & Record<string, string>; // accounts for answ-*-N fields

/** All metrics that are reported and their tuples */
type ReportedMetricAttributeTupleMap = {
  'Markdown:FormatToolbar': MetricTuple;
  'Markdown:Bold': MetricTuple;
  'Markdown:Italics': MetricTuple;
  'Markdown:Strikethrough': MetricTuple;
  'Markdown:OrderedList': MetricTuple;
  'Markdown:UnorderedList': MetricTuple;
  'Markdown:Hyperlink': MetricTuple;
  'Markdown:Blockquote': MetricTuple;
  'Markdown:InlineCode': MetricTuple;
  'Markdown:CodeBlock': MetricTuple;
  'WV:UnhandledError': MetricTuple;
  'WV:ConvoLoaded': MetricTuple<
    unknown,
    {
      firstConvo: boolean;
      messages: number;
    }
  >;
  'WV:TextMessageSent': MetricTuple;
  'WV:ConvoScrolledToBottom': MetricTuple;
  'WV:ConvoScrolledToMention': MetricTuple;
  'WV:ConvoScrolledToError': MetricTuple;
  'WV:ConvoFetchedOlderMessages': MetricTuple;
  'WV:ConvoFetchedNewerMessages': MetricTuple;
  MemoryUsageInformation: MetricTuple<MemoryUsageMetrics, MemoryUsageAttributes>;
  'WV:HourlyPerformance': MetricTuple<HourlyMetric & ResponsivenessMetric, unknown>;
  'WV:DailyPerformance': MetricTuple<DailyMetric & ResponsivenessMetric, unknown>;
  ConvoSwitch: MetricTuple<ConvoSwitchEventMetrics, ConvoSwitchEventAttributes>;
  // These two need to match qt: https://code.amazon.com/packages/WickrDesktopApp/blobs/mainline/--/clients/enterprise/countlyinterface.cpp#L342
  '[CLY]_survey': MetricTuple<unknown, SurveyMetricAttributes>;
  'SSO Account Closed': MetricTuple<any, any>;
  'Report Reason - Spam/fraud': MetricTuple;
  'Report Reason - Child exploitation/abuse': MetricTuple;
  'Report Reason - Harrassment/bullying/threats': MetricTuple;
  'Report Reason - Pretending to be someone else': MetricTuple;
  'Report Reason - Other': MetricTuple;
  MuteNotificationsStarted: MetricTuple<unknown, MuteNotificationsAttributes>;
  MuteNotificationsStopped: MetricTuple<unknown, MuteNotificationsAttributes>;
  MuteNotificationsEdited: MetricTuple<unknown, MuteNotificationsAttributes>;
  MuteNotificationsError: MetricTuple<unknown, MuteNotificationsAttributes>;
  'Consent:Shown': MetricTuple<any, any>;
  'Consent:Acknowledged': MetricTuple<any, any>;
  'Consent:SignedOut': MetricTuple<any, any>;
  'SessionTimeout:UserTriggered': MetricTuple<any, any>;
  'SessionTimeout:WarningDismissed': MetricTuple<any, any>;
  'SessionTimeout:UrgentDismissed': MetricTuple<any, any>;
};

// We need to make sure that reportedMetricNames always includes all the metrics in ReportedMetricsAttributeMap.
// TS can validate that an object has all keys, so we start with this object, which will report an error if any
// key is missing. We just use undefined as a filler, as we just use the keys to populate reportedMetricNames
const allReportedMetricsMap: Record<keyof ReportedMetricAttributeTupleMap, undefined> = {
  'Markdown:FormatToolbar': undefined,
  'Markdown:Bold': undefined,
  'Markdown:Italics': undefined,
  'Markdown:Strikethrough': undefined,
  'Markdown:OrderedList': undefined,
  'Markdown:UnorderedList': undefined,
  'Markdown:Hyperlink': undefined,
  'Markdown:Blockquote': undefined,
  'Markdown:InlineCode': undefined,
  'Markdown:CodeBlock': undefined,
  'WV:UnhandledError': undefined,
  'WV:ConvoLoaded': undefined,
  'WV:TextMessageSent': undefined,
  'WV:ConvoScrolledToBottom': undefined,
  'WV:ConvoScrolledToMention': undefined,
  'WV:ConvoScrolledToError': undefined,
  'WV:ConvoFetchedOlderMessages': undefined,
  'WV:ConvoFetchedNewerMessages': undefined,
  MemoryUsageInformation: undefined,
  'WV:HourlyPerformance': undefined,
  'WV:DailyPerformance': undefined,
  ConvoSwitch: undefined,
  '[CLY]_survey': undefined,
  'SSO Account Closed': undefined,
  'Report Reason - Spam/fraud': undefined,
  'Report Reason - Child exploitation/abuse': undefined,
  'Report Reason - Harrassment/bullying/threats': undefined,
  'Report Reason - Pretending to be someone else': undefined,
  'Report Reason - Other': undefined,
  MuteNotificationsStarted: undefined,
  MuteNotificationsStopped: undefined,
  MuteNotificationsEdited: undefined,
  MuteNotificationsError: undefined,
  'Consent:Shown': undefined,
  'Consent:Acknowledged': undefined,
  'Consent:SignedOut': undefined,
  'SessionTimeout:UserTriggered': undefined,
  'SessionTimeout:WarningDismissed': undefined,
  'SessionTimeout:UrgentDismissed': undefined,
} as const;

export type ReportedMetricName = keyof ReportedMetricAttributeTupleMap;

/** Only report these metrics */
const reportedMetricNamesSet = new Set(Object.keys(allReportedMetricsMap));

export function shouldReportMetric(name: string): boolean {
  return reportedMetricNamesSet.has(name);
}

/** All local metrics that we log  and their types */
type LocalMetricAttributeTupleMap = {
  GetConvo: MetricTuple;
  GetConvoListItems: MetricTuple;
  GetMessages: MetricTuple;
  GetPaginatedMessages: MetricTuple;
  GetMessage: MetricTuple;
  ReactToMessage: MetricTuple;
  GetUser: MetricTuple;
  GetUserById: MetricTuple;
  GetConvoUsers: MetricTuple;
  GetBlockedUsers: MetricTuple;
  GetRootFolder: MetricTuple;
  GetLegacySavedItems: MetricTuple;
  GetSavedLinks: MetricTuple;
  GetFolder: MetricTuple;
  GetFolderFromFile: MetricTuple;
  GetActiveDevices: MetricTuple;
  WebChannelOpen: [any, { name: string }];
  WebChannelInit: MetricTuple;
  xhrGet: MetricTuple;
  toUint: MetricTuple;
  decode: MetricTuple;
  toWickr: MetricTuple;
  GetRoomHistoryListItems: MetricTuple;
  GetRoomSearchItems: MetricTuple;
  GetVerificationFingerprint: MetricTuple;
  GetContacts: MetricTuple;
  SearchContacts: MetricTuple;
  GetDirectory: MetricTuple;
  ChangePassword: MetricTuple;
  ConvertDirectoryUser: MetricTuple;
  LeaveNetwork: MetricTuple;
  AdminControls: MetricTuple;
  InviteUser: MetricTuple;
  CheckUser: MetricTuple;
  PdfRenderSinglePage: MetricTuple;
  SpreadsheetToJson: MetricTuple;
  PowerPointError: MetricTuple;
  GetAwsCredentials: MetricTuple;
  GetTdfTags: MetricTuple;
};

export type MetricsAttributeTupleMap = ReportedMetricAttributeTupleMap &
  LocalMetricAttributeTupleMap;

export type MetricName = keyof MetricsAttributeTupleMap;

// https://support.count.ly/hc/en-us/articles/360037093532-Events#understanding-events
export type MetricDetails<K extends MetricName> = Partial<{
  count: number;
  sum: number;
  dur: number;
  attributes: MetricsAttributeTupleMap[K][1]; // for protobuf metric
  metrics: MetricsAttributeTupleMap[K][0]; // for protobuf metric
  segmentation: MetricsAttributeTupleMap[K][0] & MetricsAttributeTupleMap[K][1]; // for countly metric
}>;

export type AddMetrics = <K extends MetricName>(name: K, details?: MetricDetails<K>) => void;

export type MetricEvent<K extends MetricName = any> = MetricDetails<K> & {
  key: K;
};

// https://code.amazon.com/packages/WickrClientMetricsSchema/blobs/heads/mainline/--/proto/MuteNotificationsEvent.proto
export type MuteNotificationsAttributes = {
  muteDuration?: ConvoMuteOptions;
  allowSelfMentions?: boolean;
  allowAllMentions?: boolean;
  syncDevices: boolean;
  convoType: ConvoCollection.ConvoMeta.ConvoType;
  eventUiLocation: 'in-convo' | 'convo-list';
};
