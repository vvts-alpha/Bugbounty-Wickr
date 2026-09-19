package com.wickr.enterprise.api.ui;

import android.content.Context;
import android.os.Bundle;
import android.view.MenuItem;
import androidx.appcompat.app.ActionBar;
import androidx.appcompat.widget.Toolbar;
import androidx.fragment.app.FragmentTransaction;
import com.wickr.enterprise.api.connections.ApprovedAPIConnection;
import com.wickr.enterprise.api.connections.PendingAPIConnection;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.enterprise.base.ValidSessionActivity;
import com.wickr.enterprise.databinding.ActivityWickrApiBinding;
import com.wickr.enterprise.util.ViewUtil;
import com.wickr.pro.R;
import io.sentry.protocol.App;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;

/* JADX INFO: compiled from: WickrAPIActivity.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0007\b\u0007\u0018\u0000 \u00192\u00020\u00012\u00020\u00022\u00020\u00032\u00020\u0004:\u0001\u0019B\u0007¢\u0006\u0004\b\u0005\u0010\u0006J\u0012\u0010\t\u001a\u00020\n2\b\u0010\u000b\u001a\u0004\u0018\u00010\fH\u0014J\u0010\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u0010H\u0016J\u0010\u0010\u0011\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0013H\u0016J\u0010\u0010\u0014\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0013H\u0016J\u0010\u0010\u0015\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0013H\u0016J\u0010\u0010\u0016\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0013H\u0016J\u0010\u0010\u0017\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0013H\u0016J\u0010\u0010\u0018\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0013H\u0016R\u000e\u0010\u0007\u001a\u00020\bX\u0082.¢\u0006\u0002\n\u0000¨\u0006\u001a"}, d2 = {"Lcom/wickr/enterprise/api/ui/WickrAPIActivity;", "Lcom/wickr/enterprise/base/ValidSessionActivity;", "Lcom/wickr/enterprise/api/ui/APIAppsListFragment$Callback;", "Lcom/wickr/enterprise/api/ui/APIAppReviewFragment$Callback;", "Lcom/wickr/enterprise/api/ui/APIAppSuccessFragment$Callback;", "<init>", "()V", "binding", "Lcom/wickr/enterprise/databinding/ActivityWickrApiBinding;", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "onOptionsItemSelected", "", "item", "Landroid/view/MenuItem;", "onViewConnectionClicked", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", "onApproveConnectionClicked", "onDenyConnectionClicked", "onRemoveConnectionClicked", "onRouteToSuccessScreen", "onOpenAppClicked", "Companion", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WickrAPIActivity extends ValidSessionActivity implements APIAppsListFragment.Callback, APIAppReviewFragment.Callback, APIAppSuccessFragment.Callback {
    public static final String EXTRA_PAIRING_APP = "pairingApp";
    private ActivityWickrApiBinding binding;
    public static final int $stable = 8;

    @Override // com.wickr.enterprise.base.ValidSessionActivity, com.wickr.enterprise.base.BaseActivity, com.wickr.enterprise.base.Hilt_BaseActivity, androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ActivityWickrApiBinding activityWickrApiBindingInflate = ActivityWickrApiBinding.inflate(getLayoutInflater());
        Intrinsics.checkNotNullExpressionValue(activityWickrApiBindingInflate, "inflate(...)");
        this.binding = activityWickrApiBindingInflate;
        ActivityWickrApiBinding activityWickrApiBinding = null;
        if (activityWickrApiBindingInflate == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityWickrApiBindingInflate = null;
        }
        setContentView(activityWickrApiBindingInflate.getRoot());
        ActivityWickrApiBinding activityWickrApiBinding2 = this.binding;
        if (activityWickrApiBinding2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityWickrApiBinding2 = null;
        }
        setSupportActionBar(activityWickrApiBinding2.wickrApiToolbar.toolbar);
        ActionBar supportActionBar = getSupportActionBar();
        if (supportActionBar != null) {
            supportActionBar.setDisplayShowHomeEnabled(true);
        }
        ActionBar supportActionBar2 = getSupportActionBar();
        if (supportActionBar2 != null) {
            supportActionBar2.setDisplayHomeAsUpEnabled(true);
        }
        ViewUtil viewUtil = ViewUtil.INSTANCE;
        ActivityWickrApiBinding activityWickrApiBinding3 = this.binding;
        if (activityWickrApiBinding3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
        } else {
            activityWickrApiBinding = activityWickrApiBinding3;
        }
        Toolbar toolbar = activityWickrApiBinding.wickrApiToolbar.toolbar;
        Intrinsics.checkNotNullExpressionValue(toolbar, "toolbar");
        viewUtil.addTitleAccessibilityHeading(toolbar);
        if (savedInstanceState == null) {
            String stringExtra = getIntent().getStringExtra(EXTRA_PAIRING_APP);
            FragmentTransaction fragmentTransactionReplace = getSupportFragmentManager().beginTransaction().replace(R.id.fragmentContainer, APIAppsListFragment.INSTANCE.newInstance());
            String str = stringExtra;
            if (str != null && !StringsKt.isBlank(str)) {
                fragmentTransactionReplace.add(R.id.fragmentContainer, APIAppReviewFragment.INSTANCE.newInstance(stringExtra));
            }
            fragmentTransactionReplace.commit();
        }
    }

    @Override // android.app.Activity
    public boolean onOptionsItemSelected(MenuItem item) {
        Intrinsics.checkNotNullParameter(item, "item");
        if (item.getItemId() == 16908332) {
            onBackPressed();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override // com.wickr.enterprise.api.ui.APIAppsListFragment.Callback
    public void onViewConnectionClicked(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        FragmentTransaction fragmentTransactionBeginTransaction = getSupportFragmentManager().beginTransaction();
        APIAppReviewFragment.Companion companion = APIAppReviewFragment.INSTANCE;
        String packageName = app.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
        fragmentTransactionBeginTransaction.replace(R.id.fragmentContainer, companion.newInstance(packageName)).addToBackStack(APIAppReviewFragment.class.getName()).commit();
    }

    @Override // com.wickr.enterprise.api.ui.APIAppReviewFragment.Callback
    public void onApproveConnectionClicked(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        if (app instanceof PendingAPIConnection) {
            Context applicationContext = getApplicationContext();
            Intrinsics.checkNotNull(applicationContext, "null cannot be cast to non-null type com.wickr.enterprise.App");
            ((com.wickr.enterprise.App) applicationContext).getWickrContext().getApiManager().approveWickrAPIConnection((PendingAPIConnection) app);
        }
    }

    @Override // com.wickr.enterprise.api.ui.APIAppReviewFragment.Callback
    public void onDenyConnectionClicked(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        if (app instanceof PendingAPIConnection) {
            Context applicationContext = getApplicationContext();
            Intrinsics.checkNotNull(applicationContext, "null cannot be cast to non-null type com.wickr.enterprise.App");
            ((com.wickr.enterprise.App) applicationContext).getWickrContext().getApiManager().removeWickrAPIConnection(app);
        }
    }

    @Override // com.wickr.enterprise.api.ui.APIAppReviewFragment.Callback
    public void onRemoveConnectionClicked(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        if (app instanceof ApprovedAPIConnection) {
            Context applicationContext = getApplicationContext();
            Intrinsics.checkNotNull(applicationContext, "null cannot be cast to non-null type com.wickr.enterprise.App");
            ((com.wickr.enterprise.App) applicationContext).getWickrContext().getApiManager().removeWickrAPIConnection(app);
        }
    }

    @Override // com.wickr.enterprise.api.ui.APIAppReviewFragment.Callback
    public void onRouteToSuccessScreen(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        getSupportFragmentManager().popBackStack();
        FragmentTransaction fragmentTransactionBeginTransaction = getSupportFragmentManager().beginTransaction();
        APIAppSuccessFragment.Companion companion = APIAppSuccessFragment.INSTANCE;
        String packageName = app.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
        fragmentTransactionBeginTransaction.replace(R.id.fragmentContainer, companion.newInstance(packageName)).commit();
    }

    @Override // com.wickr.enterprise.api.ui.APIAppSuccessFragment.Callback
    public void onOpenAppClicked(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        startActivity(getPackageManager().getLaunchIntentForPackage(app.getAppInfo().getPackageName()));
        finish();
    }
}
