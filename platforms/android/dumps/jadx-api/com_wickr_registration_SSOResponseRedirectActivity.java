package com.wickr.registration;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import kotlin.Metadata;
import timber.log.Timber;

/* JADX INFO: compiled from: SSOResponseRedirectActivity.kt */
/* JADX INFO: loaded from: classes6.dex */
@Metadata(d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\u0018\u00002\u00020\u0001B\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\u0012\u0010\u0004\u001a\u00020\u00052\b\u0010\u0006\u001a\u0004\u0018\u00010\u0007H\u0014¨\u0006\b"}, d2 = {"Lcom/wickr/registration/SSOResponseRedirectActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "<init>", "()V", "onCreate", "", "savedInstanceBundle", "Landroid/os/Bundle;", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class SSOResponseRedirectActivity extends AppCompatActivity {
    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceBundle) {
        super.onCreate(savedInstanceBundle);
        Timber.INSTANCE.d("Received response deep link: " + getIntent().getData(), new Object[0]);
        startActivity(SSOAuthManagementActivity.INSTANCE.createResponseHandlingIntent(this, getIntent().getData()));
        finish();
    }
}
