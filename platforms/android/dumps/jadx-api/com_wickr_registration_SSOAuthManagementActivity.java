package com.wickr.registration;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.wickr.bugreporter.WickrBugReporter;
import io.sentry.protocol.Response;
import java.lang.reflect.Field;
import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import net.openid.appauth.AuthorizationManagementActivity;

/* JADX INFO: compiled from: SSOAuthManagementActivity.kt */
/* JADX INFO: loaded from: classes6.dex */
@Metadata(d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\u0018\u0000 \u000e2\u00020\u0001:\u0001\u000eB\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\b\u0010\u0006\u001a\u00020\u0007H\u0014J\u0010\u0010\b\u001a\u00020\u00072\u0006\u0010\t\u001a\u00020\nH\u0014J\u0010\u0010\u000b\u001a\u00020\u00072\u0006\u0010\f\u001a\u00020\nH\u0014J\b\u0010\r\u001a\u00020\u0007H\u0016R\u0010\u0010\u0004\u001a\u0004\u0018\u00010\u0005X\u0082\u000e¢\u0006\u0002\n\u0000¨\u0006\u000f"}, d2 = {"Lcom/wickr/registration/SSOAuthManagementActivity;", "Lnet/openid/appauth/AuthorizationManagementActivity;", "<init>", "()V", "redirectSalt", "", "onResume", "", "onSaveInstanceState", "outState", "Landroid/os/Bundle;", "onRestoreInstanceState", "savedInstanceState", "finish", "Companion", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class SSOAuthManagementActivity extends AuthorizationManagementActivity {

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    private String redirectSalt;

    /* JADX INFO: compiled from: SSOAuthManagementActivity.kt */
    @Metadata(d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003J\u0018\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u00072\b\u0010\b\u001a\u0004\u0018\u00010\tJ\u0010\u0010\n\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u0007H\u0002¨\u0006\u000b"}, d2 = {"Lcom/wickr/registration/SSOAuthManagementActivity$Companion;", "", "<init>", "()V", "createResponseHandlingIntent", "Landroid/content/Intent;", "context", "Landroid/content/Context;", Response.TYPE, "Landroid/net/Uri;", "createBaseIntent", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final Intent createResponseHandlingIntent(Context context, Uri response) {
            Intrinsics.checkNotNullParameter(context, "context");
            Intent intentCreateBaseIntent = createBaseIntent(context);
            intentCreateBaseIntent.setData(response);
            intentCreateBaseIntent.addFlags(603979776);
            return intentCreateBaseIntent;
        }

        private final Intent createBaseIntent(Context context) {
            return new Intent(context, (Class<?>) SSOAuthManagementActivity.class);
        }
    }

    @Override // net.openid.appauth.AuthorizationManagementActivity, androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onResume() {
        if (getIntent().getData() != null) {
            Uri data = getIntent().getData();
            this.redirectSalt = data != null ? data.getQueryParameter("redirect_uuid") : null;
        }
        super.onResume();
    }

    @Override // net.openid.appauth.AuthorizationManagementActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onSaveInstanceState(Bundle outState) {
        Intrinsics.checkNotNullParameter(outState, "outState");
        super.onSaveInstanceState(outState);
        outState.putString("redirect_uuid", this.redirectSalt);
    }

    @Override // android.app.Activity
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        Intrinsics.checkNotNullParameter(savedInstanceState, "savedInstanceState");
        super.onRestoreInstanceState(savedInstanceState);
        this.redirectSalt = savedInstanceState.getString("redirect_uuid");
    }

    @Override // android.app.Activity
    public void finish() {
        try {
            Field declaredField = Activity.class.getDeclaredField("mResultData");
            declaredField.setAccessible(true);
            Object obj = declaredField.get(this);
            Intent intent = obj instanceof Intent ? (Intent) obj : null;
            if (intent != null) {
                intent.putExtra("redirect_uuid", this.redirectSalt);
            }
        } catch (Exception e) {
            WickrBugReporter.report$default(e, null, null, 6, null);
        }
        super.finish();
    }
}
