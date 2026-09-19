package com.wickr.enterprise.api.modules;

import android.content.Intent;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.wickr.android.api.WickrAPI;
import com.wickr.enterprise.App;
import com.wickr.enterprise.api.WickrAPIManager;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import timber.log.Timber;

/* JADX INFO: compiled from: WickrAPICallingActivity.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0007\u0018\u00002\u00020\u0001B\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\u0012\u0010\u0004\u001a\u00020\u00052\b\u0010\u0006\u001a\u0004\u0018\u00010\u0007H\u0016¨\u0006\b"}, d2 = {"Lcom/wickr/enterprise/api/modules/WickrAPICallingActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "<init>", "()V", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WickrAPICallingActivity extends AppCompatActivity {
    public static final int $stable = 8;

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();
        if (intent == null) {
            Timber.INSTANCE.e("Missing intent", new Object[0]);
            finish();
        } else {
            if (!Intrinsics.areEqual(intent.getAction(), WickrAPI.INTENT_ACTION_CALL)) {
                Timber.INSTANCE.e("Invalid intent action: " + intent.getAction(), new Object[0]);
                finish();
                return;
            }
            WickrAPIManager apiManager = App.INSTANCE.getAppContext().getApiManager();
            intent.setAction(WickrAPI.INTENT_ACTION_REQUEST);
            apiManager.handleAPIRequest(intent);
            finish();
        }
    }
}
