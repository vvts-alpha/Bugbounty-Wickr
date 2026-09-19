package com.mywickr.config;

import com.mywickr.WickrCore;
import com.wickr.enterprise.BuildConfig;
import com.wickr.enterprise.util.GlobalsKt;
import io.sentry.protocol.Geo;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import org.json.JSONArray;
import org.json.JSONObject;
import timber.log.Timber;

/* JADX INFO: loaded from: classes4.dex */
public enum WickrConfig implements ReadReceiptConfig {
    INSTANCE;

    public static final String CALLING_FIELD = "CALLING";
    public static final String CLIENT_METRICS_CONFIG_FIELD = "clientMetricsConfig";
    public static final long MAX_UPLOAD_SIZE_DISABLED = 0;
    public static final String PASSWORD_FIELD = "passwordRequirements";
    public static final String READ_RECEIPT_FIELD = "readReceiptConfig";
    public static final String SHREDDER_FIELD = "shredder";
    public static final String SYSTEM_BANNER_FIELD = "networkBanner";
    private static final boolean canUpdate = !WickrCore.isMessenger();
    private static JSONObject runtimeConfiguration = new JSONObject();

    static {
        generateDefaults();
    }

    public enum CallingField {
        FIELD_CAN_START_1_TO_1_CALL("canStart11Call", true),
        FIELD_CAN_START_GROUP_CALL("canStartGroupCall", Boolean.valueOf(!WickrCore.isMessenger())),
        FIELD_CAN_START_ROOM_CALL("canStartRoomCall", Boolean.valueOf(!WickrCore.isMessenger())),
        FIELD_CAN_ADD_TO_CALL("canAddtoCall", Boolean.valueOf(!WickrCore.isMessenger())),
        FIELD_CAN_VIDEO_CALL("canVideoCall", Boolean.valueOf(!WickrCore.isMessenger())),
        FIELD_FORCE_TCP_CALLS("forceTcpCall", Boolean.valueOf(true ^ WickrCore.isMessenger()));

        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        CallingField(String key, Object defaultValue) {
            this(key, defaultValue, true);
        }

        CallingField(String key, Object defaultValue, final boolean updateFromServer) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$CallingField$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.CallingField.lambda$new$0(updateFromServer);
                }
            };
        }

        CallingField(String key, Object defaultValue, BooleanSupplier updateFromServerFunc) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = updateFromServerFunc;
        }
    }

    public enum PasswordField {
        FIELD_PASSWORD_REGEX("regex", "^.{8,}$"),
        FIELD_PASSWORD_MINLENGTH("minLength", 8L),
        FIELD_PASSWORD_UPPERCASE("uppercase", 0L),
        FIELD_PASSWORD_LOWERCASE("lowercase", 0L),
        FIELD_PASSWORD_NUMBERS("numbers", 0L),
        FIELD_PASSWORD_SYMBOLS("symbols", 0L);

        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        PasswordField(String key, Object defaultValue) {
            this(key, defaultValue, true);
        }

        PasswordField(String key, Object defaultValue, final boolean updateFromServer) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$PasswordField$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.PasswordField.lambda$new$0(updateFromServer);
                }
            };
        }

        PasswordField(String key, Object defaultValue, BooleanSupplier updateFromServerFunc) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = updateFromServerFunc;
        }
    }

    public enum ShredderField {
        FIELD_SHREDDER_BACKGROUND_ENABLED("canProcessInBackground", (Object) true, WickrConfig.canUpdate),
        FIELD_SHREDDER_MANUAL_ENABLED("canProcessManually", (Object) false, WickrConfig.canUpdate),
        FIELD_SHREDDER_INTENSITY("intensity", (Object) 10L, WickrConfig.canUpdate);

        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        ShredderField(String key, Object defaultValue) {
            this(key, defaultValue, true);
        }

        ShredderField(String key, Object defaultValue, final boolean updateFromServer) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$ShredderField$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.ShredderField.lambda$new$0(updateFromServer);
                }
            };
        }

        ShredderField(String key, Object defaultValue, BooleanSupplier updateFromServerFunc) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = updateFromServerFunc;
        }
    }

    public enum ClientMetricsConfigField {
        FIELD_CLIENT_METRICS_CONFIG_COGNITO_ENDPOINT("cognitoEndpoint", ""),
        FIELD_CLIENT_METRICS_CONFIG_COGNITO_IDENTITY_POOL_ID("cognitoIdentityPoolId", ""),
        FIELD_CLIENT_METRICS_CONFIG_REGION(Geo.JsonKeys.REGION, ""),
        FIELD_CLIENT_METRICS_CONFIG_KINESIS_ENDPOINT("kinesisEndpoint", "");

        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        ClientMetricsConfigField(String key, Object defaultValue) {
            this(key, defaultValue, true);
        }

        ClientMetricsConfigField(String key, Object defaultValue, final boolean updateFromServer) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$ClientMetricsConfigField$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.ClientMetricsConfigField.lambda$new$0(updateFromServer);
                }
            };
        }

        ClientMetricsConfigField(String key, Object defaultValue, BooleanSupplier updateFromServerFunc) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = updateFromServerFunc;
        }
    }

    public enum ReadReceiptField {
        FIELD_READ_RECEIPT_ENABLED("status", (Object) 0L, WickrConfig.canUpdate),
        FIELD_READ_RECEIPT_TIMESTAMP("timestamp", (Object) 0L, WickrConfig.canUpdate);

        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        ReadReceiptField(String key, Object defaultValue) {
            this(key, defaultValue, true);
        }

        ReadReceiptField(String key, Object defaultValue, final boolean updateFromServer) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$ReadReceiptField$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.ReadReceiptField.lambda$new$0(updateFromServer);
                }
            };
        }

        ReadReceiptField(String key, Object defaultValue, BooleanSupplier updateFromServerFunc) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = updateFromServerFunc;
        }
    }

    public enum SystemBannerField {
        FIELD_SYSTEM_BANNER_DISMISSIBLE("dismissible", false, WickrConfig.canUpdate),
        FIELD_SYSTEM_BANNER_ENABLED("enabled", false, WickrConfig.canUpdate),
        FIELD_SYSTEM_BANNER_CONTENT("content", ""),
        FIELD_SYSTEM_BANNER_SEVERITY("severity", "");

        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        SystemBannerField(String key, Object defaultValue) {
            this(key, defaultValue, true);
        }

        SystemBannerField(String key, Object defaultValue, final boolean updateFromServer) {
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$SystemBannerField$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.SystemBannerField.lambda$new$0(updateFromServer);
                }
            };
        }
    }

    /* JADX WARN: Enum visitor error
    jadx.core.utils.exceptions.JadxRuntimeException: Init of enum field 'FIELD_FILE_MANAGEMENT_ENABLED' uses external variables
    	at jadx.core.dex.visitors.EnumVisitor.createEnumFieldByConstructor(EnumVisitor.java:485)
    	at jadx.core.dex.visitors.EnumVisitor.processEnumFieldByField(EnumVisitor.java:399)
    	at jadx.core.dex.visitors.EnumVisitor.processEnumFieldByWrappedInsn(EnumVisitor.java:364)
    	at jadx.core.dex.visitors.EnumVisitor.extractEnumFieldsFromFilledArray(EnumVisitor.java:349)
    	at jadx.core.dex.visitors.EnumVisitor.extractEnumFieldsFromInsn(EnumVisitor.java:284)
    	at jadx.core.dex.visitors.EnumVisitor.extractEnumFieldsFromInvoke(EnumVisitor.java:315)
    	at jadx.core.dex.visitors.EnumVisitor.extractEnumFieldsFromInsn(EnumVisitor.java:288)
    	at jadx.core.dex.visitors.EnumVisitor.convertToEnum(EnumVisitor.java:153)
    	at jadx.core.dex.visitors.EnumVisitor.visit(EnumVisitor.java:102)
     */
    /* JADX WARN: Failed to restore enum class, 'enum' modifier and super class removed */
    public static final class Field {
        private static final /* synthetic */ Field[] $VALUES;
        public static final Field FIELD_BOT_BUTTONS_IN_ROOMS_ENABLED;
        public static final Field FIELD_CAN_ADD_CONTACT;
        public static final Field FIELD_CENTRALIZED_ROOM_STATE_ENABLED;
        public static final Field FIELD_CHIME_LAUNCHER_INTEGRATION_ENABLED;
        public static final Field FIELD_CLIENT_METRICS_ENABLED;
        public static final Field FIELD_ENABLE_CHECK_FOR_UPDATE;
        public static final Field FIELD_ENABLE_NOTIFICATION_PREVIEW;
        public static final Field FIELD_ENABLE_WICKR_API;
        public static final Field FIELD_FILES_ENABLED;
        public static final Field FIELD_FILE_DOWNLOADS_ENABLED;
        public static final Field FIELD_FILE_MANAGEMENT_ENABLED;
        public static final Field FIELD_FORCE_ACCOUNT_SUSPENSION;
        public static final Field FIELD_FORCE_DEVICE_LOCKOUT;
        public static final Field FIELD_FRIEND_FINDER;
        public static final Field FIELD_GUARD_ENABLED;
        public static final Field FIELD_INVITE_USER;
        public static final Field FIELD_LINK_PREVIEWS_ENABLED;
        public static final Field FIELD_LOCATION_ENABLED;
        public static final Field FIELD_LOCATION_ENABLE_MAPS;
        public static final Field FIELD_MAX_BURN_ON_READ_TTL;
        public static final Field FIELD_MAX_ENVELOPE_TTL;
        public static final Field FIELD_MAX_UPLOAD_SIZE;
        public static final Field FIELD_MESSAGE_FORWARDING_ENABLED;
        public static final Field FIELD_MESSAGE_TRANSLATION_ENABLED;
        public static final Field FIELD_MLS_PROTOCOL_ENABLE;
        public static final Field FIELD_ONLY_SHOW_IN_NETWORK_CONTACTS;
        public static final Field FIELD_PRESENCE_ENABLED;
        public static final Field FIELD_QUICK_RESPONSES;
        public static final Field FIELD_RANDOM_SERVERS;
        public static final Field FIELD_RICH_PROFILE_CARD_ENABLED;
        public static final Field FIELD_SECURITY_LEVEL_ID;
        public static final Field FIELD_SHOW_HOMOGRAPH_WARNING;
        public static final Field FIELD_VERIFICATION_MODE;
        public static final Field FIELD_WICKR_API_ALLOW_LIST;
        public static final Field FIELD_WOA_ENABLE;
        public static final Field FIELD_WOA_FORCE_ENABLE;
        public static final Field FIELD_WOA_REGIONS;
        public Object defaultValue;
        public String fieldName;
        public BooleanSupplier updateFromServerFunc;
        public static final Field FIELD_CAN_CHANGE_PASSWORD = new Field("FIELD_CAN_CHANGE_PASSWORD", 0, "canChangePassword", (Object) true, WickrConfig.canUpdate);
        public static final Field FIELD_MAX_AUTO_DOWNLOAD_SIZE = new Field("FIELD_MAX_AUTO_DOWNLOAD_SIZE", 1, "maxAutoDownloadSize", 5000000L);
        public static final Field FIELD_ALWAYS_REAUTHENTICATE = new Field("FIELD_ALWAYS_REAUTHENTICATE", 2, "alwaysReauthenticate", (Object) false, WickrConfig.canUpdate);
        public static final Field FIELD_CAN_START_CALL = new Field("FIELD_CAN_START_CALL", 3, "canStartCall", true);
        public static final Field FIELD_ROOMS_ENABLED = new Field("FIELD_ROOMS_ENABLED", 4, "roomsEnabled", Boolean.valueOf(!WickrCore.isMessenger()));
        public static final Field FIELD_CAN_CREATE_ROOM = new Field("FIELD_CAN_CREATE_ROOM", 5, "canCreateRoom", Boolean.valueOf(!WickrCore.isMessenger()), WickrConfig.canUpdate);

        static /* synthetic */ boolean lambda$new$0(boolean z) {
            return z;
        }

        private static /* synthetic */ Field[] $values() {
            return new Field[]{FIELD_CAN_CHANGE_PASSWORD, FIELD_MAX_AUTO_DOWNLOAD_SIZE, FIELD_ALWAYS_REAUTHENTICATE, FIELD_CAN_START_CALL, FIELD_ROOMS_ENABLED, FIELD_CAN_CREATE_ROOM, FIELD_MAX_ENVELOPE_TTL, FIELD_MAX_BURN_ON_READ_TTL, FIELD_MAX_UPLOAD_SIZE, FIELD_FRIEND_FINDER, FIELD_ONLY_SHOW_IN_NETWORK_CONTACTS, FIELD_CAN_ADD_CONTACT, FIELD_FORCE_DEVICE_LOCKOUT, FIELD_FORCE_ACCOUNT_SUSPENSION, FIELD_VERIFICATION_MODE, FIELD_ENABLE_NOTIFICATION_PREVIEW, FIELD_INVITE_USER, FIELD_LOCATION_ENABLED, FIELD_LOCATION_ENABLE_MAPS, FIELD_PRESENCE_ENABLED, FIELD_WOA_FORCE_ENABLE, FIELD_SHOW_HOMOGRAPH_WARNING, FIELD_RANDOM_SERVERS, FIELD_QUICK_RESPONSES, FIELD_FILES_ENABLED, FIELD_RICH_PROFILE_CARD_ENABLED, FIELD_BOT_BUTTONS_IN_ROOMS_ENABLED, FIELD_CLIENT_METRICS_ENABLED, FIELD_LINK_PREVIEWS_ENABLED, FIELD_GUARD_ENABLED, FIELD_SECURITY_LEVEL_ID, FIELD_ENABLE_CHECK_FOR_UPDATE, FIELD_CENTRALIZED_ROOM_STATE_ENABLED, FIELD_FILE_MANAGEMENT_ENABLED, FIELD_MESSAGE_TRANSLATION_ENABLED, FIELD_CHIME_LAUNCHER_INTEGRATION_ENABLED, FIELD_WOA_ENABLE, FIELD_FILE_DOWNLOADS_ENABLED, FIELD_WOA_REGIONS, FIELD_MLS_PROTOCOL_ENABLE, FIELD_MESSAGE_FORWARDING_ENABLED, FIELD_ENABLE_WICKR_API, FIELD_WICKR_API_ALLOW_LIST};
        }

        public static Field valueOf(String name) {
            return (Field) Enum.valueOf(Field.class, name);
        }

        public static Field[] values() {
            return (Field[]) $VALUES.clone();
        }

        static {
            FIELD_MAX_ENVELOPE_TTL = new Field("FIELD_MAX_ENVELOPE_TTL", 6, "maxTTL", Long.valueOf(WickrCore.isMessenger() ? 518400L : 31536000L), WickrConfig.canUpdate);
            FIELD_MAX_BURN_ON_READ_TTL = new Field("FIELD_MAX_BURN_ON_READ_TTL", 7, "maxBOR", (Object) 0L, WickrConfig.canUpdate);
            FIELD_MAX_UPLOAD_SIZE = new Field("FIELD_MAX_UPLOAD_SIZE", 8, "maxUploadSize", (Object) (-1L), true);
            FIELD_FRIEND_FINDER = new Field("FIELD_FRIEND_FINDER", 9, "friendFinder", Boolean.valueOf(!WickrCore.isEnterprise()), WickrCore.isPro());
            FIELD_ONLY_SHOW_IN_NETWORK_CONTACTS = new Field("FIELD_ONLY_SHOW_IN_NETWORK_CONTACTS", 10, "onlyShowInNetwork", false);
            FIELD_CAN_ADD_CONTACT = new Field("FIELD_CAN_ADD_CONTACT", 11, "canAddContact", (Object) true, WickrConfig.canUpdate);
            FIELD_FORCE_DEVICE_LOCKOUT = new Field("FIELD_FORCE_DEVICE_LOCKOUT", 12, "forceDeviceLockout", (Object) 5L, WickrConfig.canUpdate);
            FIELD_FORCE_ACCOUNT_SUSPENSION = new Field("FIELD_FORCE_ACCOUNT_SUSPENSION", 13, "lockoutThreshold", (Object) 10L, WickrConfig.canUpdate);
            FIELD_VERIFICATION_MODE = new Field("FIELD_VERIFICATION_MODE", 14, GlobalsKt.INTENT_EXTRA_VERIFICATION_MODE, (Object) Integer.valueOf(VerificationMode.OPTIONAL.getValue()), true);
            FIELD_ENABLE_NOTIFICATION_PREVIEW = new Field("FIELD_ENABLE_NOTIFICATION_PREVIEW", 15, "enableNotificationPreview", (Object) true, true);
            FIELD_INVITE_USER = new Field("FIELD_INVITE_USER", 16, "inviteUser", (Object) 1L, WickrConfig.canUpdate);
            FIELD_LOCATION_ENABLED = new Field("FIELD_LOCATION_ENABLED", 17, "locationEnabled", Boolean.valueOf(!WickrCore.isMessenger()));
            FIELD_LOCATION_ENABLE_MAPS = new Field("FIELD_LOCATION_ENABLE_MAPS", 18, "locationAllowMaps", Boolean.valueOf(!WickrCore.isMessenger()));
            FIELD_PRESENCE_ENABLED = new Field("FIELD_PRESENCE_ENABLED", 19, "presenceEnabled", false);
            FIELD_WOA_FORCE_ENABLE = new Field("FIELD_WOA_FORCE_ENABLE", 20, "forceOpenAccess", (Object) false, !WickrCore.isMessenger());
            FIELD_SHOW_HOMOGRAPH_WARNING = new Field("FIELD_SHOW_HOMOGRAPH_WARNING", 21, "showHomographWarning", false);
            FIELD_RANDOM_SERVERS = new Field("FIELD_RANDOM_SERVERS", 22, "randomizeDomains", false);
            FIELD_QUICK_RESPONSES = new Field("FIELD_QUICK_RESPONSES", 23, "quickResponses", new String[0]);
            FIELD_FILES_ENABLED = new Field("FIELD_FILES_ENABLED", 24, "filesEnabled", true);
            FIELD_RICH_PROFILE_CARD_ENABLED = new Field("FIELD_RICH_PROFILE_CARD_ENABLED", 25, "enableRichProfileCard", false);
            FIELD_BOT_BUTTONS_IN_ROOMS_ENABLED = new Field("FIELD_BOT_BUTTONS_IN_ROOMS_ENABLED", 26, "enableBotButtonsInRooms", false);
            FIELD_CLIENT_METRICS_ENABLED = new Field("FIELD_CLIENT_METRICS_ENABLED", 27, "enableClientMetrics", false);
            FIELD_LINK_PREVIEWS_ENABLED = new Field("FIELD_LINK_PREVIEWS_ENABLED", 28, "isLinkPreviewEnabled", (Object) true, true);
            FIELD_GUARD_ENABLED = new Field("FIELD_GUARD_ENABLED", 29, "guardEnabled", (Object) false, WickrConfig.canUpdate);
            FIELD_SECURITY_LEVEL_ID = new Field("FIELD_SECURITY_LEVEL_ID", 30, "securityLevelId", (Object) 0L, WickrConfig.canUpdate);
            FIELD_ENABLE_CHECK_FOR_UPDATE = new Field("FIELD_ENABLE_CHECK_FOR_UPDATE", 31, "checkForUpdates", (Object) true, WickrConfig.canUpdate);
            FIELD_CENTRALIZED_ROOM_STATE_ENABLED = new Field("FIELD_CENTRALIZED_ROOM_STATE_ENABLED", 32, "centralRoomStateEnabled", (Object) false, false);
            final WickrCore wickrCore = WickrCore.INSTANCE;
            Objects.requireNonNull(wickrCore);
            FIELD_FILE_MANAGEMENT_ENABLED = new Field("FIELD_FILE_MANAGEMENT_ENABLED", 33, "fileManagementEnabled", (Object) false, new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$Field$$ExternalSyntheticLambda0
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return wickrCore.getEnableFileManagement();
                }
            });
            final WickrCore wickrCore2 = WickrCore.INSTANCE;
            Objects.requireNonNull(wickrCore2);
            FIELD_MESSAGE_TRANSLATION_ENABLED = new Field("FIELD_MESSAGE_TRANSLATION_ENABLED", 34, "translationStatus", (Object) false, new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$Field$$ExternalSyntheticLambda1
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return wickrCore2.getEnableMessageTranslation();
                }
            });
            FIELD_CHIME_LAUNCHER_INTEGRATION_ENABLED = new Field("FIELD_CHIME_LAUNCHER_INTEGRATION_ENABLED", 35, "chimeLauncherIntegEnabled", (Object) false, false);
            FIELD_WOA_ENABLE = new Field("FIELD_WOA_ENABLE", 36, "enableOpenAccessOption", (Object) false, !WickrCore.isMessenger());
            final WickrCore wickrCore3 = WickrCore.INSTANCE;
            Objects.requireNonNull(wickrCore3);
            FIELD_FILE_DOWNLOADS_ENABLED = new Field("FIELD_FILE_DOWNLOADS_ENABLED", 37, "enableFileDownload", (Object) true, new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$Field$$ExternalSyntheticLambda2
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return wickrCore3.getEnableFilePreview();
                }
            });
            FIELD_WOA_REGIONS = new Field("FIELD_WOA_REGIONS", 38, "woaRegions", "");
            FIELD_MLS_PROTOCOL_ENABLE = new Field("FIELD_MLS_PROTOCOL_ENABLE", 39, "enableMlsProtocol", (Object) false, new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$Field$$ExternalSyntheticLambda3
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrCore.isMLSSupportEnabled();
                }
            });
            final WickrCore wickrCore4 = WickrCore.INSTANCE;
            Objects.requireNonNull(wickrCore4);
            FIELD_MESSAGE_FORWARDING_ENABLED = new Field("FIELD_MESSAGE_FORWARDING_ENABLED", 40, "messageForwardingEnabled", (Object) false, new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$Field$$ExternalSyntheticLambda4
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return wickrCore4.getEnableMessageForwarding();
                }
            });
            FIELD_ENABLE_WICKR_API = new Field("FIELD_ENABLE_WICKR_API", 41, "enableAtak", (Object) false, WickrConfig.canUpdate);
            FIELD_WICKR_API_ALLOW_LIST = new Field("FIELD_WICKR_API_ALLOW_LIST", 42, "atakPackageValues", new String[0], WickrConfig.canUpdate);
            $VALUES = $values();
        }

        private Field(String $enum$name, int $enum$ordinal, String key, Object defaultValue) {
            this($enum$name, $enum$ordinal, key, defaultValue, true);
        }

        private Field(String $enum$name, int $enum$ordinal, String key, Object defaultValue, final boolean updateFromServer) {
            super($enum$name, $enum$ordinal);
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = new BooleanSupplier() { // from class: com.mywickr.config.WickrConfig$Field$$ExternalSyntheticLambda5
                @Override // java.util.function.BooleanSupplier
                public final boolean getAsBoolean() {
                    return WickrConfig.Field.lambda$new$0(updateFromServer);
                }
            };
        }

        private Field(String $enum$name, int $enum$ordinal, String key, Object defaultValue, BooleanSupplier updateFromServerFunc) {
            super($enum$name, $enum$ordinal);
            this.fieldName = key;
            this.defaultValue = defaultValue;
            this.updateFromServerFunc = updateFromServerFunc;
        }
    }

    public static void generateDefaults() {
        try {
            Timber.i("Generating config defaults", new Object[0]);
            runtimeConfiguration = new JSONObject();
            for (Field field : Field.values()) {
                Object obj = field.defaultValue;
                if (obj instanceof long[]) {
                    JSONArray jSONArray = new JSONArray();
                    for (long j : (long[]) obj) {
                        jSONArray.put(j);
                    }
                    obj = jSONArray;
                }
                if (obj instanceof String[]) {
                    JSONArray jSONArray2 = new JSONArray();
                    for (String str : (String[]) obj) {
                        jSONArray2.put(str);
                    }
                    obj = jSONArray2;
                }
                runtimeConfiguration.put(field.fieldName, obj);
            }
            JSONObject jSONObject = new JSONObject();
            for (CallingField callingField : CallingField.values()) {
                Object obj2 = callingField.defaultValue;
                if (obj2 instanceof long[]) {
                    JSONArray jSONArray3 = new JSONArray();
                    for (long j2 : (long[]) obj2) {
                        jSONArray3.put(j2);
                    }
                    obj2 = jSONArray3;
                }
                if (obj2 instanceof String[]) {
                    JSONArray jSONArray4 = new JSONArray();
                    for (String str2 : (String[]) obj2) {
                        jSONArray4.put(str2);
                    }
                    obj2 = jSONArray4;
                }
                jSONObject.put(callingField.fieldName, obj2);
            }
            runtimeConfiguration.put(CALLING_FIELD, jSONObject);
            JSONObject jSONObject2 = new JSONObject();
            for (PasswordField passwordField : PasswordField.values()) {
                Object obj3 = passwordField.defaultValue;
                if (obj3 instanceof long[]) {
                    JSONArray jSONArray5 = new JSONArray();
                    for (long j3 : (long[]) obj3) {
                        jSONArray5.put(j3);
                    }
                    obj3 = jSONArray5;
                }
                if (obj3 instanceof String[]) {
                    JSONArray jSONArray6 = new JSONArray();
                    for (String str3 : (String[]) obj3) {
                        jSONArray6.put(str3);
                    }
                    obj3 = jSONArray6;
                }
                jSONObject2.put(passwordField.fieldName, obj3);
            }
            runtimeConfiguration.put(PASSWORD_FIELD, jSONObject2);
            JSONObject jSONObject3 = new JSONObject();
            for (ShredderField shredderField : ShredderField.values()) {
                Object obj4 = shredderField.defaultValue;
                if (obj4 instanceof long[]) {
                    JSONArray jSONArray7 = new JSONArray();
                    for (long j4 : (long[]) obj4) {
                        jSONArray7.put(j4);
                    }
                    obj4 = jSONArray7;
                }
                if (obj4 instanceof String[]) {
                    JSONArray jSONArray8 = new JSONArray();
                    for (String str4 : (String[]) obj4) {
                        jSONArray8.put(str4);
                    }
                    obj4 = jSONArray8;
                }
                jSONObject3.put(shredderField.fieldName, obj4);
            }
            runtimeConfiguration.put(SHREDDER_FIELD, jSONObject3);
            JSONObject jSONObject4 = new JSONObject();
            for (ClientMetricsConfigField clientMetricsConfigField : ClientMetricsConfigField.values()) {
                Object obj5 = clientMetricsConfigField.defaultValue;
                if (obj5 instanceof long[]) {
                    JSONArray jSONArray9 = new JSONArray();
                    for (long j5 : (long[]) obj5) {
                        jSONArray9.put(j5);
                    }
                    obj5 = jSONArray9;
                }
                if (obj5 instanceof String[]) {
                    JSONArray jSONArray10 = new JSONArray();
                    for (String str5 : (String[]) obj5) {
                        jSONArray10.put(str5);
                    }
                    obj5 = jSONArray10;
                }
                jSONObject4.put(clientMetricsConfigField.fieldName, obj5);
            }
            runtimeConfiguration.put(CLIENT_METRICS_CONFIG_FIELD, jSONObject4);
            JSONObject jSONObject5 = new JSONObject();
            for (ReadReceiptField readReceiptField : ReadReceiptField.values()) {
                Object obj6 = readReceiptField.defaultValue;
                if (obj6 instanceof long[]) {
                    JSONArray jSONArray11 = new JSONArray();
                    for (long j6 : (long[]) obj6) {
                        jSONArray11.put(j6);
                    }
                    obj6 = jSONArray11;
                }
                if (obj6 instanceof String[]) {
                    JSONArray jSONArray12 = new JSONArray();
                    for (String str6 : (String[]) obj6) {
                        jSONArray12.put(str6);
                    }
                    obj6 = jSONArray12;
                }
                jSONObject5.put(readReceiptField.fieldName, obj6);
            }
            runtimeConfiguration.put(READ_RECEIPT_FIELD, jSONObject5);
            JSONObject jSONObject6 = new JSONObject();
            for (SystemBannerField systemBannerField : SystemBannerField.values()) {
                Object obj7 = systemBannerField.defaultValue;
                if (obj7 instanceof long[]) {
                    JSONArray jSONArray13 = new JSONArray();
                    for (long j7 : (long[]) obj7) {
                        jSONArray13.put(j7);
                    }
                    obj7 = jSONArray13;
                }
                if (obj7 instanceof String[]) {
                    JSONArray jSONArray14 = new JSONArray();
                    for (String str7 : (String[]) obj7) {
                        jSONArray14.put(str7);
                    }
                    obj7 = jSONArray14;
                }
                jSONObject6.put(systemBannerField.fieldName, obj7);
            }
            runtimeConfiguration.put(SYSTEM_BANNER_FIELD, jSONObject6);
            Timber.d("Generated default config: %s", runtimeConfiguration.toString());
        } catch (Exception e) {
            Timber.e(e);
        }
    }

    public boolean canChangePassword() {
        return ((Boolean) getValueForField(Field.FIELD_CAN_CHANGE_PASSWORD)).booleanValue();
    }

    public boolean canStartCall() {
        return ((Boolean) getValueForField(Field.FIELD_CAN_START_CALL)).booleanValue();
    }

    public boolean canStart1To1Call() {
        return ((Boolean) getValueForField(CallingField.FIELD_CAN_START_1_TO_1_CALL)).booleanValue();
    }

    public boolean canStartGroupCall() {
        return ((Boolean) getValueForField(CallingField.FIELD_CAN_START_GROUP_CALL)).booleanValue();
    }

    public boolean canStartRoomCall() {
        return ((Boolean) getValueForField(CallingField.FIELD_CAN_START_ROOM_CALL)).booleanValue();
    }

    public boolean canAddtoCall() {
        return ((Boolean) getValueForField(CallingField.FIELD_CAN_ADD_TO_CALL)).booleanValue();
    }

    public boolean canStartVideo() {
        return ((Boolean) getValueForField(CallingField.FIELD_CAN_VIDEO_CALL)).booleanValue();
    }

    public boolean isForceTCPCallingEnabled() {
        return ((Boolean) getValueForField(CallingField.FIELD_FORCE_TCP_CALLS)).booleanValue();
    }

    public boolean areRoomsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_ROOMS_ENABLED)).booleanValue();
    }

    public boolean canCreateRoom() {
        return ((Boolean) getValueForField(Field.FIELD_CAN_CREATE_ROOM)).booleanValue();
    }

    public long[] getAvailableEnvelopeTTL() {
        if (WickrCore.isEnterprise() || WickrCore.isPro()) {
            return new long[]{28800, 86400, 2592000, 15552000, 31536000};
        }
        if (WickrCore.isMessenger()) {
            return new long[]{43200, 86400, 172800, 345600, 518400};
        }
        return new long[0];
    }

    public long getDefaultEnvelopeTTL() {
        if (WickrCore.isMessenger()) {
            return Math.min(518400L, getMaxEnvelopeTTL());
        }
        return getMaxEnvelopeTTL();
    }

    public long[] getAvailableBurnOnReadTTL() {
        return new long[]{0, 5, 60, BuildConfig.SESSION_TIMEOUT_WARNING_THRESHOLD, 86400};
    }

    public long getDefaultBurnOnReadTTL() {
        return getMaxBurnOnReadTTL();
    }

    public long getMaxEnvelopeTTL() {
        return ((Long) getValueForField(Field.FIELD_MAX_ENVELOPE_TTL)).longValue();
    }

    public long getMaxBurnOnReadTTL() {
        return ((Long) getValueForField(Field.FIELD_MAX_BURN_ON_READ_TTL)).longValue();
    }

    public long getMaxAutoDownloadSize() {
        return ((Long) getValueForField(Field.FIELD_MAX_AUTO_DOWNLOAD_SIZE)).longValue();
    }

    public boolean shouldAlwaysReauthenticate() {
        return ((Boolean) getValueForField(Field.FIELD_ALWAYS_REAUTHENTICATE)).booleanValue();
    }

    public long getMaxUploadSize() {
        return ((Long) getValueForField(Field.FIELD_MAX_UPLOAD_SIZE)).longValue();
    }

    public boolean isFriendFinderEnabled() {
        return WickrCore.INSTANCE.getEnableContactFinder() && ((Boolean) getValueForField(Field.FIELD_FRIEND_FINDER)).booleanValue();
    }

    public boolean onlyShowInNetworkContacts() {
        return ((Boolean) getValueForField(Field.FIELD_ONLY_SHOW_IN_NETWORK_CONTACTS)).booleanValue();
    }

    public boolean canAddContact() {
        return ((Boolean) getValueForField(Field.FIELD_CAN_ADD_CONTACT)).booleanValue();
    }

    public long getForceDeviceLockout() {
        return ((Long) getValueForField(Field.FIELD_FORCE_DEVICE_LOCKOUT)).longValue();
    }

    public long getForceAccountSuspension() {
        return ((Long) getValueForField(Field.FIELD_FORCE_ACCOUNT_SUSPENSION)).longValue();
    }

    public VerificationMode getVerificationMode() {
        if (WickrCore.getDeviceConfig().exists() && !WickrCore.getDeviceConfig().requireVideoVerification()) {
            return VerificationMode.NONE;
        }
        return VerificationMode.fromValue(Long.valueOf(((Long) getValueForField(Field.FIELD_VERIFICATION_MODE)).longValue()).intValue());
    }

    public boolean areNotificationPreviewsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_ENABLE_NOTIFICATION_PREVIEW)).booleanValue();
    }

    public long getInviteUserFlag() {
        return ((Long) getValueForField(Field.FIELD_INVITE_USER)).longValue();
    }

    public boolean isLocationEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_LOCATION_ENABLED)).booleanValue();
    }

    public boolean areLocationMapsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_LOCATION_ENABLE_MAPS)).booleanValue();
    }

    public boolean isPresenceEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_PRESENCE_ENABLED)).booleanValue();
    }

    public boolean isForceOpenAccessEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_WOA_FORCE_ENABLE)).booleanValue();
    }

    public boolean isHomographWarningEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_SHOW_HOMOGRAPH_WARNING)).booleanValue();
    }

    public List<String> getQuickResponses() {
        return Arrays.asList((String[]) getValueForField(Field.FIELD_QUICK_RESPONSES));
    }

    public void setQuickResponses(List<String> quickResponses) {
        setConfigValue(Field.FIELD_QUICK_RESPONSES, (String[]) quickResponses.toArray(new String[0]));
    }

    public boolean isCheckForUpdatesEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_ENABLE_CHECK_FOR_UPDATE)).booleanValue();
    }

    public String getPasswordRegex() {
        return (String) getValueForField(PasswordField.FIELD_PASSWORD_REGEX);
    }

    public long getPasswordMinLength() {
        return ((Long) getValueForField(PasswordField.FIELD_PASSWORD_MINLENGTH)).longValue();
    }

    public long getPasswordLowercase() {
        return ((Long) getValueForField(PasswordField.FIELD_PASSWORD_LOWERCASE)).longValue();
    }

    public long getPasswordUppercase() {
        return ((Long) getValueForField(PasswordField.FIELD_PASSWORD_UPPERCASE)).longValue();
    }

    public long getPasswordNumbers() {
        return ((Long) getValueForField(PasswordField.FIELD_PASSWORD_NUMBERS)).longValue();
    }

    public long getPasswordSymbols() {
        return ((Long) getValueForField(PasswordField.FIELD_PASSWORD_SYMBOLS)).longValue();
    }

    public boolean areFilesEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_FILES_ENABLED)).booleanValue();
    }

    public boolean isRichProfileCardEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_RICH_PROFILE_CARD_ENABLED)).booleanValue();
    }

    public boolean isBotButtonsInRoomsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_BOT_BUTTONS_IN_ROOMS_ENABLED)).booleanValue();
    }

    public boolean isClientMetricsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_CLIENT_METRICS_ENABLED)).booleanValue();
    }

    public boolean isMessageTranslationEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_MESSAGE_TRANSLATION_ENABLED)).booleanValue();
    }

    public boolean areLinkPreviewsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_LINK_PREVIEWS_ENABLED)).booleanValue();
    }

    public boolean isShredderBackgroundEnabled() {
        return ((Boolean) getValueForField(ShredderField.FIELD_SHREDDER_BACKGROUND_ENABLED)).booleanValue();
    }

    public boolean isShredderManualEnabled() {
        return ((Boolean) getValueForField(ShredderField.FIELD_SHREDDER_MANUAL_ENABLED)).booleanValue();
    }

    public long getShredderIntensity() {
        return ((Long) getValueForField(ShredderField.FIELD_SHREDDER_INTENSITY)).longValue();
    }

    public String getClientMetricsConfigCognitoEndpoint() {
        return (String) getValueForField(ClientMetricsConfigField.FIELD_CLIENT_METRICS_CONFIG_COGNITO_ENDPOINT);
    }

    public String getClientMetricsConfigCognitoIdentityPoolId() {
        return (String) getValueForField(ClientMetricsConfigField.FIELD_CLIENT_METRICS_CONFIG_COGNITO_IDENTITY_POOL_ID);
    }

    public String getClientMetricsConfigRegion() {
        return (String) getValueForField(ClientMetricsConfigField.FIELD_CLIENT_METRICS_CONFIG_REGION);
    }

    public String getClientMetricsConfigKinesisEndpoint() {
        return (String) getValueForField(ClientMetricsConfigField.FIELD_CLIENT_METRICS_CONFIG_KINESIS_ENDPOINT);
    }

    public long getSecurityLevelId() {
        return ((Long) getValueForField(Field.FIELD_SECURITY_LEVEL_ID)).longValue();
    }

    public boolean isGuardEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_GUARD_ENABLED)).booleanValue();
    }

    public boolean isFileManagementEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_FILE_MANAGEMENT_ENABLED)).booleanValue();
    }

    public boolean isWOAEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_WOA_ENABLE)).booleanValue();
    }

    public boolean isFileDownloadsEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_FILE_DOWNLOADS_ENABLED)).booleanValue();
    }

    public String getWoaRegions() {
        return (String) getValueForField(Field.FIELD_WOA_REGIONS);
    }

    public boolean isMlsProtocolEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_MLS_PROTOCOL_ENABLE)).booleanValue();
    }

    public boolean isMessageForwardingEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_MESSAGE_FORWARDING_ENABLED)).booleanValue();
    }

    public boolean isWickrAPIEnabled() {
        return ((Boolean) getValueForField(Field.FIELD_ENABLE_WICKR_API)).booleanValue();
    }

    public List<String> getWickrAPIAllowList() {
        String[] strArr = (String[]) getValueForField(Field.FIELD_WICKR_API_ALLOW_LIST);
        if (strArr == null) {
            strArr = new String[0];
        }
        return Arrays.asList(strArr);
    }

    @Override // com.mywickr.config.ReadReceiptConfig
    public ReadReceiptMode getReadReceiptMode() {
        return ReadReceiptMode.INSTANCE.fromValue((int) ((Long) getValueForField(ReadReceiptField.FIELD_READ_RECEIPT_ENABLED)).longValue());
    }

    @Override // com.mywickr.config.ReadReceiptConfig
    public long getReadReceiptEnableTimestamp() {
        return ((Long) getValueForField(ReadReceiptField.FIELD_READ_RECEIPT_TIMESTAMP)).longValue();
    }

    @Override // com.mywickr.config.ReadReceiptConfig
    public boolean areReadReceiptsEnabled() {
        return getReadReceiptMode() == ReadReceiptMode.ENABLED || getReadReceiptMode() == ReadReceiptMode.FORCE_ENABLED;
    }

    public boolean isSystemBannerEnabled() {
        return ((Boolean) getValueForField(SystemBannerField.FIELD_SYSTEM_BANNER_ENABLED)).booleanValue();
    }

    public String getSystemBannerContent() {
        return (String) getValueForField(SystemBannerField.FIELD_SYSTEM_BANNER_CONTENT);
    }

    public String getSystemBannerSeverity() {
        return (String) getValueForField(SystemBannerField.FIELD_SYSTEM_BANNER_SEVERITY);
    }

    public boolean isSystemBannerDismissible() {
        return ((Boolean) getValueForField(SystemBannerField.FIELD_SYSTEM_BANNER_DISMISSIBLE)).booleanValue();
    }

    /* JADX WARN: Code duplicated, block: B:16:0x006d A[Catch: Exception -> 0x007b, TRY_LEAVE, TryCatch #0 {Exception -> 0x007b, blocks: (B:3:0x000c, B:5:0x0010, B:7:0x001b, B:14:0x003c, B:16:0x006d, B:9:0x0025, B:11:0x0029, B:13:0x0034), top: B:23:0x000c }] */
    /* JADX WARN: Code duplicated, block: B:27:? A[RETURN, SYNTHETIC] */
    private void setConfigValue(Field field, Object value, boolean postEvent) {
        JSONArray jSONArray;
        Timber.d("Manually setting config field %s to value: %s", value, field.fieldName);
        try {
            if (value instanceof long[]) {
                jSONArray = new JSONArray();
                for (long j : (long[]) value) {
                    jSONArray.put(j);
                }
            } else {
                if (value instanceof String[]) {
                    jSONArray = new JSONArray();
                    for (String str : (String[]) value) {
                        jSONArray.put(str);
                    }
                }
                runtimeConfiguration.put(field.fieldName, value);
                Timber.d("Set config field " + field.fieldName + " to " + value.toString(), new Object[0]);
                if (postEvent) {
                    WickrCore.postEvent(new Event(true, exportConfig()));
                }
            }
            value = jSONArray;
            runtimeConfiguration.put(field.fieldName, value);
            Timber.d("Set config field " + field.fieldName + " to " + value.toString(), new Object[0]);
            if (postEvent) {
                WickrCore.postEvent(new Event(true, exportConfig()));
            }
        } catch (Exception e) {
            Timber.e(e);
            if (postEvent) {
                WickrCore.postEvent(new Event(false, exportConfig()));
            }
        }
    }

    public void setConfigValue(Field field, Object value) {
        setConfigValue(field, value, true);
    }

    public boolean loadConfig(String jsonConfig, boolean forceUpdate) {
        if (jsonConfig == null) {
            Timber.e("Unable to load null network configuration", new Object[0]);
            return false;
        }
        try {
            Timber.i("Loading new network configuration. forced: %b", Boolean.valueOf(forceUpdate));
            JSONObject jSONObject = new JSONObject(jsonConfig);
            Timber.d("Loading network config: %s", jsonConfig);
            Timber.d("Current config before load: %s", exportConfig());
            if (jSONObject.has(CALLING_FIELD)) {
                JSONObject jSONObject2 = jSONObject.getJSONObject(CALLING_FIELD);
                for (CallingField callingField : CallingField.values()) {
                    if (callingField.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                        putValueForField(jSONObject2, callingField);
                    }
                }
            }
            if (jSONObject.has(PASSWORD_FIELD)) {
                JSONObject jSONObject3 = jSONObject.getJSONObject(PASSWORD_FIELD);
                for (PasswordField passwordField : PasswordField.values()) {
                    if (passwordField.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                        putValueForField(jSONObject3, passwordField);
                    }
                }
            }
            if (jSONObject.has(SHREDDER_FIELD)) {
                JSONObject jSONObject4 = jSONObject.getJSONObject(SHREDDER_FIELD);
                for (ShredderField shredderField : ShredderField.values()) {
                    if (shredderField.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                        putValueForField(jSONObject4, shredderField);
                    }
                }
            }
            if (jSONObject.has(CLIENT_METRICS_CONFIG_FIELD)) {
                JSONObject jSONObject5 = jSONObject.getJSONObject(CLIENT_METRICS_CONFIG_FIELD);
                for (ClientMetricsConfigField clientMetricsConfigField : ClientMetricsConfigField.values()) {
                    if (clientMetricsConfigField.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                        putValueForField(jSONObject5, clientMetricsConfigField);
                    }
                }
            }
            if (jSONObject.has(READ_RECEIPT_FIELD)) {
                JSONObject jSONObject6 = jSONObject.getJSONObject(READ_RECEIPT_FIELD);
                for (ReadReceiptField readReceiptField : ReadReceiptField.values()) {
                    if (readReceiptField.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                        putValueForField(jSONObject6, readReceiptField);
                    }
                }
            }
            if (jSONObject.has(SYSTEM_BANNER_FIELD)) {
                JSONObject jSONObject7 = jSONObject.getJSONObject(SYSTEM_BANNER_FIELD);
                for (SystemBannerField systemBannerField : SystemBannerField.values()) {
                    if (systemBannerField.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                        putValueForField(jSONObject7, systemBannerField);
                    }
                }
            }
            for (Field field : Field.values()) {
                if (field.updateFromServerFunc.getAsBoolean() || forceUpdate) {
                    putValueForField(jSONObject, field);
                }
            }
            String strExportConfig = exportConfig();
            Timber.d("Current config after loading: %s", strExportConfig);
            WickrCore.postEvent(new Event(true, strExportConfig));
            return true;
        } catch (Exception e) {
            Timber.e(e);
            WickrCore.postEvent(new Event(false, exportConfig()));
            return false;
        }
    }

    private void putValueForField(JSONObject configuration, Field field) {
        putValue(configuration, null, field.fieldName, field.defaultValue);
    }

    private void putValueForField(JSONObject configuration, CallingField field) {
        putValue(configuration, CALLING_FIELD, field.fieldName, field.defaultValue);
    }

    private void putValueForField(JSONObject configuration, PasswordField field) {
        putValue(configuration, PASSWORD_FIELD, field.fieldName, field.defaultValue);
    }

    private void putValueForField(JSONObject configuration, ShredderField field) {
        putValue(configuration, SHREDDER_FIELD, field.fieldName, field.defaultValue);
    }

    private void putValueForField(JSONObject configuration, ClientMetricsConfigField field) {
        putValue(configuration, CLIENT_METRICS_CONFIG_FIELD, field.fieldName, field.defaultValue);
    }

    private void putValueForField(JSONObject configuration, ReadReceiptField field) {
        putValue(configuration, READ_RECEIPT_FIELD, field.fieldName, field.defaultValue);
    }

    private void putValueForField(JSONObject configuration, SystemBannerField field) {
        putValue(configuration, SYSTEM_BANNER_FIELD, field.fieldName, field.defaultValue);
    }

    private void putValue(JSONObject configuration, String rootObject, String fieldName, Object defaultValue) {
        JSONObject jSONObject;
        JSONArray jSONArray;
        try {
            if (rootObject == null) {
                jSONObject = runtimeConfiguration;
            } else if (runtimeConfiguration.has(rootObject)) {
                jSONObject = runtimeConfiguration.getJSONObject(rootObject);
            } else {
                jSONObject = new JSONObject();
                runtimeConfiguration.put(rootObject, jSONObject);
            }
            if (!configuration.has(fieldName)) {
                jSONObject.put(fieldName, jSONObject.get(fieldName));
                return;
            }
            if (configuration.isNull(fieldName)) {
                int i = 0;
                if (defaultValue instanceof long[]) {
                    jSONArray = new JSONArray();
                    long[] jArr = (long[]) defaultValue;
                    int length = jArr.length;
                    while (i < length) {
                        jSONArray.put(jArr[i]);
                        i++;
                    }
                } else {
                    if (defaultValue instanceof String[]) {
                        jSONArray = new JSONArray();
                        String[] strArr = (String[]) defaultValue;
                        int length2 = strArr.length;
                        while (i < length2) {
                            jSONArray.put(strArr[i]);
                            i++;
                        }
                    }
                    jSONObject.put(fieldName, defaultValue);
                    return;
                }
                defaultValue = jSONArray;
                jSONObject.put(fieldName, defaultValue);
                return;
            }
            jSONObject.put(fieldName, configuration.get(fieldName));
        } catch (Exception e) {
            Timber.e(e);
        }
    }

    private boolean parseBooleanFromValue(Object object) {
        if (object instanceof Boolean) {
            return ((Boolean) object).booleanValue();
        }
        if (object instanceof Number) {
            return ((Number) object).intValue() == 1;
        }
        if (object instanceof String) {
            return Boolean.parseBoolean((String) object);
        }
        return false;
    }

    public Object getValueForField(Field field) {
        Object value = getValue(null, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValueForField(CallingField field) {
        Object value = getValue(CALLING_FIELD, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValueForField(PasswordField field) {
        Object value = getValue(PASSWORD_FIELD, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValueForField(ShredderField field) {
        Object value = getValue(SHREDDER_FIELD, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValueForField(ClientMetricsConfigField field) {
        Object value = getValue(CLIENT_METRICS_CONFIG_FIELD, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValueForField(ReadReceiptField field) {
        Object value = getValue(READ_RECEIPT_FIELD, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValueForField(SystemBannerField field) {
        Object value = getValue(SYSTEM_BANNER_FIELD, field.fieldName, field.defaultValue, field.updateFromServerFunc);
        return field.defaultValue instanceof Boolean ? Boolean.valueOf(parseBooleanFromValue(value)) : value;
    }

    private Object getValue(String rootObject, String fieldName, Object defaultValue, BooleanSupplier updateFromServerFunc) {
        JSONObject jSONObject;
        try {
            if (rootObject != null && runtimeConfiguration.has(rootObject)) {
                jSONObject = runtimeConfiguration.getJSONObject(rootObject);
            } else {
                jSONObject = runtimeConfiguration;
            }
            if (jSONObject.has(fieldName) && updateFromServerFunc.getAsBoolean()) {
                Object obj = jSONObject.get(fieldName);
                if (!(obj instanceof JSONArray)) {
                    return obj instanceof Number ? Long.valueOf(((Number) obj).longValue()) : obj;
                }
                JSONArray jSONArray = (JSONArray) obj;
                int i = 0;
                if (jSONArray.length() == 0) {
                    if (defaultValue instanceof String[]) {
                        return new String[0];
                    }
                    if (defaultValue instanceof long[]) {
                        return new long[0];
                    }
                } else {
                    if (jSONArray.get(0) instanceof Number) {
                        long[] jArr = new long[jSONArray.length()];
                        while (i < jSONArray.length()) {
                            jArr[i] = ((Number) jSONArray.get(i)).longValue();
                            i++;
                        }
                        return jArr;
                    }
                    if (jSONArray.get(0) instanceof String) {
                        String[] strArr = new String[jSONArray.length()];
                        while (i < jSONArray.length()) {
                            strArr[i] = jSONArray.getString(i);
                            i++;
                        }
                        return strArr;
                    }
                }
            }
            return defaultValue;
        } catch (Exception e) {
            Timber.e(e);
            return defaultValue;
        }
    }

    public String exportConfig() {
        return runtimeConfiguration.toString();
    }

    public String exportConfig(int indentSpaces) {
        try {
            return runtimeConfiguration.toString(indentSpaces);
        } catch (Exception unused) {
            return exportConfig();
        }
    }

    public static class Event {
        public final String config;
        public final boolean success;

        public Event(boolean success, String config) {
            this.success = success;
            this.config = config;
        }
    }
}
