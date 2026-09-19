package com.wickr.enterprise.registration;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.mywickr.helpers.SharedPreferencesHelper;
import com.mywickr.networking.requests.RegistrationService;
import com.mywickr.wickr.WickrDBAdapter;
import com.wickr.analytics.WickrAnalytics;
import com.wickr.enterprise.newonboarding.NewOnboardingActivity;
import com.wickr.enterprise.util.BuildUtils;
import com.wickr.pro.R;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;
import timber.log.Timber;

/* JADX INFO: compiled from: RegistrationLinkActivity.kt */
/* JADX INFO: loaded from: classes5.dex */
@Metadata(d1 = {"\u00002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0006\b\u0007\u0018\u0000 \u00162\u00020\u0001:\u0001\u0016B\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\u0012\u0010\u0004\u001a\u00020\u00052\b\u0010\u0006\u001a\u0004\u0018\u00010\u0007H\u0014J\u0012\u0010\b\u001a\u00020\u00052\b\u0010\t\u001a\u0004\u0018\u00010\nH\u0002J0\u0010\u000b\u001a\u00020\u00052\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u000e\u001a\u00020\r2\u0006\u0010\u000f\u001a\u00020\r2\u0006\u0010\u0010\u001a\u00020\u00112\u0006\u0010\u0012\u001a\u00020\rH\u0002J \u0010\u0013\u001a\u00020\u00052\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u0014\u001a\u00020\r2\u0006\u0010\u0012\u001a\u00020\rH\u0002J\u0018\u0010\u0015\u001a\u00020\u00052\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u000e\u001a\u00020\rH\u0002¨\u0006\u0017"}, d2 = {"Lcom/wickr/enterprise/registration/RegistrationLinkActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "<init>", "()V", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "processDeepLink", "intent", "Landroid/content/Intent;", "startRegistrationForSSO", "username", "", RegistrationLinkActivity.DEEP_LINK_ARG_TRANSACTION_ID, RegistrationLinkActivity.DEEP_LINK_ARG_COMPANYID, "showMRK", "", "region", "startRegistrationForInviteCode", "inviteCode", "startRegistrationForForgotPasswordDeepLink", "Companion", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class RegistrationLinkActivity extends AppCompatActivity {
    private static final String DEEP_LINK_ARG_CODE = "code";
    private static final String DEEP_LINK_ARG_COMPANYID = "companyId";
    private static final String DEEP_LINK_ARG_EMAIL = "email";
    private static final String DEEP_LINK_ARG_REGION = "region";
    private static final String DEEP_LINK_ARG_SHOW_MRK = "mrk";
    private static final String DEEP_LINK_ARG_TRANSACTION_ID = "transactionId";
    private static final String DEEP_LINK_ARG_TX_ID = "txId";
    private static final String DEEP_LINK_ARG_USERNAME = "username";
    public static final int $stable = 8;

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Timber.INSTANCE.i("Launching Deep Link processing", new Object[0]);
        if (getIntent() == null) {
            Timber.INSTANCE.e("No intent was provided", new Object[0]);
            finish();
        } else {
            processDeepLink(getIntent());
            finish();
        }
    }

    private final void processDeepLink(Intent intent) {
        Uri data;
        String str;
        if (intent == null || (data = intent.getData()) == null) {
            return;
        }
        Timber.INSTANCE.d("Parsing deep link: " + data, new Object[0]);
        List<String> queryParameters = data.getQueryParameters("username");
        Intrinsics.checkNotNullExpressionValue(queryParameters, "getQueryParameters(...)");
        String str2 = (String) CollectionsKt.firstOrNull((List) queryParameters);
        if (str2 == null) {
            str2 = "";
        }
        List<String> queryParameters2 = data.getQueryParameters("email");
        Intrinsics.checkNotNullExpressionValue(queryParameters2, "getQueryParameters(...)");
        String str3 = (String) CollectionsKt.firstOrNull((List) queryParameters2);
        if (str3 == null) {
            str3 = "";
        }
        List<String> queryParameters3 = data.getQueryParameters("region");
        Intrinsics.checkNotNullExpressionValue(queryParameters3, "getQueryParameters(...)");
        String str4 = (String) CollectionsKt.firstOrNull((List) queryParameters3);
        String str5 = str4 == null ? "" : str4;
        if (str3.length() > 0) {
            str = str3;
        } else {
            str = str2.length() > 0 ? str2 : "";
        }
        RegistrationLinkActivity registrationLinkActivity = this;
        boolean zDoesDBExist = WickrDBAdapter.doesDBExist(registrationLinkActivity);
        List<String> queryParameters4 = data.getQueryParameters(DEEP_LINK_ARG_TX_ID);
        Intrinsics.checkNotNullExpressionValue(queryParameters4, "getQueryParameters(...)");
        String str6 = (String) CollectionsKt.firstOrNull((List) queryParameters4);
        if (str6 == null) {
            str6 = "";
        }
        String str7 = str;
        if (str7.length() > 0 && str6.length() > 0) {
            if (BuildUtils.INSTANCE.isAWSBuild()) {
                String string = getString(R.string.countly_aws_onboarding_entered_using_deeplink);
                Intrinsics.checkNotNullExpressionValue(string, "getString(...)");
                WickrAnalytics.logEvent$default(string, null, 2, null);
                if (zDoesDBExist) {
                    Timber.INSTANCE.i("User is logged in during forgot password flow, checking username from deeplink", new Object[0]);
                    String string2 = SharedPreferencesHelper.getDefaultSharedPreferences(registrationLinkActivity).getString(RegistrationService.PREF_ACCOUNT_USERNAME, null);
                    if (Intrinsics.areEqual(string2 != null ? string2 : "", str)) {
                        Timber.INSTANCE.i("Username matches, posting forgot password event", new Object[0]);
                        startRegistrationForForgotPasswordDeepLink(str, str6);
                        finish();
                        return;
                    } else {
                        Timber.INSTANCE.e("Forgot password deeplink username doesn't match signed in user", new Object[0]);
                        finish();
                        return;
                    }
                }
                Timber.INSTANCE.i("User is not logged in, navigating to forgot password deeplink flow", new Object[0]);
                startRegistrationForForgotPasswordDeepLink(str, str6);
                return;
            }
            return;
        }
        if (zDoesDBExist) {
            Timber.INSTANCE.e("Ignoring deep link in configured app", new Object[0]);
            finish();
            return;
        }
        if (BuildUtils.INSTANCE.isAWSBuild()) {
            String string3 = getString(R.string.countly_aws_onboarding_entered_using_deeplink);
            Intrinsics.checkNotNullExpressionValue(string3, "getString(...)");
            WickrAnalytics.logEvent$default(string3, null, 2, null);
        }
        if (BuildUtils.INSTANCE.isAWSBuild() || BuildUtils.INSTANCE.isEnterpriseBuild()) {
            Timber.INSTANCE.i("Checking for SSO deep link", new Object[0]);
            String queryParameter = data.getQueryParameter(DEEP_LINK_ARG_TRANSACTION_ID);
            String str8 = queryParameter == null ? "" : queryParameter;
            String queryParameter2 = data.getQueryParameter(DEEP_LINK_ARG_COMPANYID);
            String str9 = queryParameter2 == null ? "" : queryParameter2;
            String queryParameter3 = data.getQueryParameter(DEEP_LINK_ARG_SHOW_MRK);
            boolean z = queryParameter3 != null && Integer.parseInt(queryParameter3) == 1;
            if (str7.length() > 0 && str8.length() > 0 && str9.length() > 0) {
                startRegistrationForSSO(str, str8, str9, z, str5);
                return;
            }
            Timber.INSTANCE.e("Deep link does not contain SSO registration data", new Object[0]);
        }
        if (BuildUtils.INSTANCE.isAWSBuild()) {
            Timber.INSTANCE.i("Checking for Pro deep link", new Object[0]);
            String queryParameter4 = data.getQueryParameter("code");
            String str10 = queryParameter4 != null ? queryParameter4 : "";
            if (str7.length() > 0 && str10.length() > 0) {
                startRegistrationForInviteCode(str, str10, str5);
                return;
            }
            Timber.INSTANCE.e("Deep link does not contain Pro registration data", new Object[0]);
        }
        Timber.INSTANCE.w("Routing to default registration UI", new Object[0]);
        startActivity(RegistrationActivity.INSTANCE.getIntent(registrationLinkActivity));
    }

    private final void startRegistrationForSSO(String username, String transactionId, String companyId, boolean showMRK, String region) {
        Timber.INSTANCE.d("Routing to SSO registration with username: " + username + ", transactionID: " + transactionId + ", companyID: " + companyId + ", mrk: " + showMRK + ", region: " + region, new Object[0]);
        Intent intentIntentForSSODeepLink = NewOnboardingActivity.INSTANCE.intentForSSODeepLink(this, username, transactionId, companyId, showMRK, region);
        intentIntentForSSODeepLink.addFlags(268468224);
        startActivity(intentIntentForSSODeepLink);
    }

    private final void startRegistrationForInviteCode(String username, String inviteCode, String region) {
        if (BuildUtils.INSTANCE.isAWSBuild()) {
            Timber.INSTANCE.d("Routing to AWS registration with username: " + username + " , code: " + inviteCode + ", region: " + region + " ", new Object[0]);
            startActivity(NewOnboardingActivity.INSTANCE.intentForProDeepLink(this, username, inviteCode, region));
        }
    }

    private final void startRegistrationForForgotPasswordDeepLink(String username, String transactionId) {
        if (BuildUtils.INSTANCE.isAWSBuild()) {
            Timber.INSTANCE.d("Routing to AWS forgot password email check with username: " + username + " , txID: " + transactionId + " ", new Object[0]);
            startActivity(NewOnboardingActivity.INSTANCE.intentForForgotPasswordDeepLink(this, username, transactionId));
        }
    }
}
