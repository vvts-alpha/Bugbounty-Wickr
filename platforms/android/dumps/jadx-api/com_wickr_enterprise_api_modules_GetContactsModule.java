package com.wickr.enterprise.api.modules;

import androidx.constraintlayout.core.motion.utils.TypedValues;
import com.mywickr.interfaces.WickrUserInterface;
import com.mywickr.wickr.WickrAliasType;
import com.mywickr.wickr.WickrUser;
import com.mywickr.wickr.WickrUserValidator;
import com.mywickr.wickr.WickrUserValidatorResult;
import com.wickr.android.api.WickrAPI;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.android.api.WickrAPIResponses;
import com.wickr.enterprise.api.APIUtilsKt;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.networking.model.DirectoryIndexRequest;
import com.wickr.networking.model.DirectoryIndexResponse;
import com.wickr.networking.model.DirectoryUser;
import com.wickr.search.SearchResult;
import com.wickr.session.Session;
import com.wickr.util.ExtensionsKt;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.functions.Function;
import io.reactivex.rxjava3.schedulers.Schedulers;
import io.sentry.SentryBaseEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import io.sentry.protocol.ViewHierarchyNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import kotlin.Lazy;
import kotlin.LazyKt;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.coroutines.Continuation;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;
import okhttp3.Response;
import okhttp3.ResponseBody;
import timber.log.Timber;

/* JADX INFO: compiled from: GetContactsModule.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0002\b\u0004\b\u0007\u0018\u0000 *2\u00020\u0001:\u0001*B\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0004\b\u0006\u0010\u0007J \u0010\u0015\u001a\u0004\u0018\u00010\u00162\u0006\u0010\u0017\u001a\u00020\u00182\u0006\u0010\u0019\u001a\u00020\u001aH\u0096@¢\u0006\u0002\u0010\u001bJ\"\u0010\u001c\u001a\u0004\u0018\u00010\u00162\u0006\u0010\u0017\u001a\u00020\u00182\u0006\u0010\u001d\u001a\u00020\n2\u0006\u0010\u0019\u001a\u00020\u001eH\u0002J\u0012\u0010\u001f\u001a\u0004\u0018\u00010 2\u0006\u0010!\u001a\u00020\nH\u0002J\u001e\u0010\"\u001a\b\u0012\u0004\u0012\u00020\u000f0\t2\u0006\u0010#\u001a\u00020$2\u0006\u0010%\u001a\u00020$H\u0002J\u0018\u0010&\u001a\u00020'2\u0006\u0010(\u001a\u00020\n2\u0006\u0010)\u001a\u00020 H\u0002R\u001a\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR+\u0010\r\u001a\u0012\u0012\u0004\u0012\u00020\u000f0\u000ej\b\u0012\u0004\u0012\u00020\u000f`\u00108BX\u0082\u0084\u0002¢\u0006\f\n\u0004\b\u0013\u0010\u0014\u001a\u0004\b\u0011\u0010\u0012¨\u0006+"}, d2 = {"Lcom/wickr/enterprise/api/modules/GetContactsModule;", "Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "<init>", "(Lcom/wickr/enterprise/api/WickrAPIContext;Lcom/wickr/session/Session;)V", "requests", "", "", "getRequests", "()Ljava/util/List;", "searchResultComparator", "Ljava/util/Comparator;", "Lcom/wickr/android/api/WickrAPIObjects$WickrUser;", "Lkotlin/Comparator;", "getSearchResultComparator", "()Ljava/util/Comparator;", "searchResultComparator$delegate", "Lkotlin/Lazy;", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processGetContactListAction", ViewHierarchyNode.JsonKeys.IDENTIFIER, "Lcom/wickr/android/api/WickrAPIRequests$GetContactsRequest;", "exactSearch", "Lcom/wickr/search/SearchResult;", "query", "loadDirectoryPage", TypedValues.CycleType.S_WAVE_OFFSET, "", "pageSize", "addToCache", "", WickrAPI.EXTRA_PACKAGE_NAME, SentryBaseEvent.JsonKeys.USER, "Companion", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class GetContactsModule extends WickrAPIModule {
    private final List<String> requests;

    /* JADX INFO: renamed from: searchResultComparator$delegate, reason: from kotlin metadata */
    private final Lazy searchResultComparator;

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    public static final int $stable = 8;
    private static final ConcurrentHashMap<String, HashMap<String, SearchResult>> SEARCHED_USERS = new ConcurrentHashMap<>();

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public GetContactsModule(WickrAPIContext apiContext, Session session) {
        super(apiContext, session);
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        this.requests = CollectionsKt.listOf("GETCONTACTSREQUEST");
        this.searchResultComparator = LazyKt.lazy(new Function0() { // from class: com.wickr.enterprise.api.modules.GetContactsModule$$ExternalSyntheticLambda0
            @Override // kotlin.jvm.functions.Function0
            public final Object invoke() {
                return GetContactsModule.searchResultComparator_delegate$lambda$0();
            }
        });
    }

    /* JADX INFO: compiled from: GetContactsModule.kt */
    @Metadata(d1 = {"\u0000$\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003R9\u0010\u0004\u001a*\u0012\u0004\u0012\u00020\u0006\u0012 \u0012\u001e\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\b0\u0007j\u000e\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\b`\t0\u0005¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000b¨\u0006\f"}, d2 = {"Lcom/wickr/enterprise/api/modules/GetContactsModule$Companion;", "", "<init>", "()V", "SEARCHED_USERS", "Ljava/util/concurrent/ConcurrentHashMap;", "", "Ljava/util/HashMap;", "Lcom/wickr/search/SearchResult;", "Lkotlin/collections/HashMap;", "getSEARCHED_USERS", "()Ljava/util/concurrent/ConcurrentHashMap;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final ConcurrentHashMap<String, HashMap<String, SearchResult>> getSEARCHED_USERS() {
            return GetContactsModule.SEARCHED_USERS;
        }
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public List<String> getRequests() {
        return this.requests;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final Comparator<WickrAPIObjects.WickrUser> getSearchResultComparator() {
        return (Comparator) this.searchResultComparator.getValue();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Comparator searchResultComparator_delegate$lambda$0() {
        return new Comparator() { // from class: com.wickr.enterprise.api.modules.GetContactsModule$$ExternalSyntheticLambda1
            @Override // java.util.Comparator
            public final int compare(Object obj, Object obj2) {
                return GetContactsModule.searchResultComparator_delegate$lambda$0$0((WickrAPIObjects.WickrUser) obj, (WickrAPIObjects.WickrUser) obj2);
            }
        };
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final int searchResultComparator_delegate$lambda$0$0(WickrAPIObjects.WickrUser wickrUser, WickrAPIObjects.WickrUser wickrUser2) {
        Intrinsics.checkNotNull(wickrUser);
        String strPrimaryName = APIUtilsKt.primaryName(wickrUser);
        Intrinsics.checkNotNull(wickrUser2);
        return StringsKt.compareTo(strPrimaryName, APIUtilsKt.primaryName(wickrUser2), true);
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        Timber.INSTANCE.i("Processing request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
        if (!wickrAPIRequest.hasGetContactsRequest()) {
            return WickrAPIObjects.APIError.INTERNAL_ERROR;
        }
        String identifier = wickrAPIRequest.getIdentifier();
        Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
        WickrAPIRequests.GetContactsRequest getContactsRequest = wickrAPIRequest.getGetContactsRequest();
        Intrinsics.checkNotNullExpressionValue(getContactsRequest, "getGetContactsRequest(...)");
        return processGetContactListAction(wickrAPIConnection, identifier, getContactsRequest);
    }

    private final WickrAPIObjects.APIError processGetContactListAction(final WickrAPIConnection app, String identifier, final WickrAPIRequests.GetContactsRequest request) {
        if (request.hasQuery()) {
            String query = request.getQuery();
            Intrinsics.checkNotNullExpressionValue(query, "getQuery(...)");
            if (StringsKt.isBlank(query) && request.getUseDirectory()) {
                if (!request.hasOffset() || !request.hasCount()) {
                    Timber.INSTANCE.e("Request is missing the offset and/or count", new Object[0]);
                    return WickrAPIObjects.APIError.INVALID_REQUEST;
                }
                if (request.getOffset() < 0 || request.getCount() <= 0) {
                    Timber.INSTANCE.e("Request offset and/or count are invalid", new Object[0]);
                    return WickrAPIObjects.APIError.INVALID_REQUEST;
                }
            }
        }
        Object objBlockingLast = Single.just(request.hasQuery() ? request.getQuery() : "").subscribeOn(Schedulers.io()).observeOn(Schedulers.io()).toObservable().map(new Function() { // from class: com.wickr.enterprise.api.modules.GetContactsModule$processGetContactListAction$search$1
            @Override // io.reactivex.rxjava3.functions.Function
            public final List<WickrAPIObjects.WickrUser> apply(String str) {
                List<SearchResult> listBlockingFirst;
                Intrinsics.checkNotNull(str);
                String str2 = str;
                if (StringsKt.isBlank(str2) && request.getUseDirectory()) {
                    Timber.INSTANCE.i("Fetching new directory page", new Object[0]);
                    return CollectionsKt.sortedWith(this.loadDirectoryPage(request.getOffset(), request.getCount()), this.getSearchResultComparator());
                }
                Timber.INSTANCE.d("Searching for " + str, new Object[0]);
                List<SearchResult> listBlockingFirst2 = this.getApiContext().getUserLocalSearchRepository().submitQuery(str).blockingFirst();
                List<SearchResult> list = listBlockingFirst2;
                Timber.INSTANCE.i("Found " + list.size() + " local contacts", new Object[0]);
                Intrinsics.checkNotNullExpressionValue(listBlockingFirst2, "also(...)");
                if (StringsKt.isBlank(str2)) {
                    listBlockingFirst = null;
                } else {
                    listBlockingFirst = this.getApiContext().getUserServerSearchRepository().submitQuery(str).blockingFirst();
                    Timber.INSTANCE.i("Found " + listBlockingFirst.size() + " server contacts", new Object[0]);
                }
                SearchResult searchResultExactSearch = StringsKt.isBlank(str2) ? null : this.exactSearch(str);
                LinkedHashMap linkedHashMap = new LinkedHashMap();
                GetContactsModule getContactsModule = this;
                WickrAPIConnection wickrAPIConnection = app;
                if (listBlockingFirst != null) {
                    for (SearchResult searchResult : listBlockingFirst) {
                        linkedHashMap.put(searchResult.getServerIDHash(), searchResult);
                        String packageName = wickrAPIConnection.getAppInfo().getPackageName();
                        Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
                        getContactsModule.addToCache(packageName, searchResult);
                    }
                }
                for (SearchResult searchResult2 : list) {
                    linkedHashMap.put(searchResult2.getServerIDHash(), searchResult2);
                }
                if (searchResultExactSearch != null) {
                    linkedHashMap.put(searchResultExactSearch.getServerIDHash(), searchResultExactSearch);
                    String packageName2 = wickrAPIConnection.getAppInfo().getPackageName();
                    Intrinsics.checkNotNullExpressionValue(packageName2, "getPackageName(...)");
                    getContactsModule.addToCache(packageName2, searchResultExactSearch);
                }
                linkedHashMap.remove(getContactsModule.getSession().getUsernameHash());
                Collection collectionValues = linkedHashMap.values();
                Intrinsics.checkNotNullExpressionValue(collectionValues, "<get-values>(...)");
                Collection<SearchResult> collection = collectionValues;
                ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(collection, 10));
                for (SearchResult searchResult3 : collection) {
                    Intrinsics.checkNotNull(searchResult3);
                    arrayList.add(APIUtilsKt.toWickrAPIUser(searchResult3));
                }
                return CollectionsKt.sortedWith(arrayList, this.getSearchResultComparator());
            }
        }).blockingLast();
        Intrinsics.checkNotNullExpressionValue(objBlockingLast, "blockingLast(...)");
        List listEmptyList = (List) objBlockingLast;
        int iCoerceAtMost = RangesKt.coerceAtMost(request.getOffset() + request.getCount(), listEmptyList.size());
        if ((request.hasOffset() || request.hasCount()) && request.getOffset() >= 0 && request.getCount() >= 0) {
            if (iCoerceAtMost <= request.getOffset() || listEmptyList.isEmpty()) {
                listEmptyList = CollectionsKt.emptyList();
            } else {
                listEmptyList = listEmptyList.subList(request.getOffset(), iCoerceAtMost);
            }
        }
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(identifier).setGetContactsResponse(WickrAPIResponses.GetContactsResponse.newBuilder().addAllContacts(listEmptyList).setIsDirectory(request.getUseDirectory()).build()).build();
        WickrAPIContext apiContext = getApiContext();
        Intrinsics.checkNotNull(wickrAPIResponseBuild);
        apiContext.sendResponse(app, wickrAPIResponseBuild);
        return null;
    }

    /* JADX INFO: Access modifiers changed from: private */
    /* JADX WARN: Code duplicated, block: B:24:0x0105 A[Catch: Exception -> 0x0130, TryCatch #0 {Exception -> 0x0130, blocks: (B:3:0x0005, B:6:0x0011, B:8:0x0051, B:10:0x0067, B:12:0x006e, B:14:0x0082, B:19:0x0089, B:21:0x0095, B:23:0x00e2, B:24:0x0105, B:25:0x010f, B:27:0x0113, B:29:0x011d), top: B:34:0x0005 }] */
    /* JADX WARN: Code duplicated, block: B:25:0x010f A[Catch: Exception -> 0x0130, TryCatch #0 {Exception -> 0x0130, blocks: (B:3:0x0005, B:6:0x0011, B:8:0x0051, B:10:0x0067, B:12:0x006e, B:14:0x0082, B:19:0x0089, B:21:0x0095, B:23:0x00e2, B:24:0x0105, B:25:0x010f, B:27:0x0113, B:29:0x011d), top: B:34:0x0005 }] */
    /* JADX WARN: Code duplicated, block: B:27:0x0113 A[Catch: Exception -> 0x0130, TryCatch #0 {Exception -> 0x0130, blocks: (B:3:0x0005, B:6:0x0011, B:8:0x0051, B:10:0x0067, B:12:0x006e, B:14:0x0082, B:19:0x0089, B:21:0x0095, B:23:0x00e2, B:24:0x0105, B:25:0x010f, B:27:0x0113, B:29:0x011d), top: B:34:0x0005 }] */
    /* JADX WARN: Code duplicated, block: B:28:0x011c  */
    public final SearchResult exactSearch(String query) {
        Integer numValueOf;
        try {
            WickrUser userWithAlias = WickrUser.getUserWithAlias(query);
            if (userWithAlias != null) {
                String primaryName = userWithAlias.getPrimaryName();
                String serverIdHash = userWithAlias.getServerIdHash();
                Intrinsics.checkNotNullExpressionValue(serverIdHash, "getServerIdHash(...)");
                String userAlias = userWithAlias.getUserAlias();
                Intrinsics.checkNotNullExpressionValue(userAlias, "getUserAlias(...)");
                boolean zIsInNetwork = userWithAlias.isInNetwork();
                String networkID = userWithAlias.getNetworkID();
                Intrinsics.checkNotNullExpressionValue(networkID, "getNetworkID(...)");
                return new SearchResult(primaryName, serverIdHash, userAlias, 1, zIsInNetwork, networkID, userWithAlias.getIsStarred(), userWithAlias.isBlocked(), userWithAlias.getUserImageRaw(), userWithAlias.isNew(), userWithAlias.isRecent(), userWithAlias.isBot(), userWithAlias.getVerificationStatus());
            }
            WickrUserValidator wickrUserValidator = new WickrUserValidator(getSession(), query, WickrAliasType.WICKR_USERNAME_ALIAS);
            Response responseMakeServerCall = wickrUserValidator.makeServerCall(0L, null);
            if (responseMakeServerCall != null) {
                boolean z = true;
                if (responseMakeServerCall.isSuccessful()) {
                    Intrinsics.checkNotNull(responseMakeServerCall);
                    ResponseBody responseBodyBody = responseMakeServerCall.body();
                    Intrinsics.checkNotNull(responseBodyBody);
                    WickrUserValidatorResult[] wickrUserValidatorResultArrProcessServerResponse = wickrUserValidator.processServerResponse(responseBodyBody.bytes());
                    if (wickrUserValidatorResultArrProcessServerResponse != null) {
                        if (wickrUserValidatorResultArrProcessServerResponse.length != 0) {
                            z = false;
                        }
                        if (!z) {
                            WickrUserValidatorResult wickrUserValidatorResult = wickrUserValidatorResultArrProcessServerResponse[0];
                            if (!wickrUserValidatorResult.getAPICode().isError()) {
                                Timber.INSTANCE.i("Found user, returning search result", new Object[0]);
                                WickrUserInterface user = wickrUserValidatorResult.getUser();
                                String primaryName2 = user.getPrimaryName();
                                String serverIdHash2 = user.getServerIdHash();
                                Intrinsics.checkNotNullExpressionValue(serverIdHash2, "getServerIdHash(...)");
                                String userAlias2 = user.getUserAlias();
                                Intrinsics.checkNotNullExpressionValue(userAlias2, "getUserAlias(...)");
                                boolean zIsInNetwork2 = user.isInNetwork();
                                String networkID2 = user.getNetworkID();
                                Intrinsics.checkNotNullExpressionValue(networkID2, "getNetworkID(...)");
                                return new SearchResult(primaryName2, serverIdHash2, userAlias2, 0, zIsInNetwork2, networkID2, user.getIsStarred(), user.isBlocked(), user.getUserImageRaw(), user.isNew(), user.isRecent(), user.isBot(), user.getVerificationStatus());
                            }
                            Timber.INSTANCE.e("Validator returned error " + wickrUserValidatorResult.getAPICode().getValue() + " for query", new Object[0]);
                        } else {
                            Timber.INSTANCE.e("No validator results", new Object[0]);
                        }
                    } else {
                        Timber.INSTANCE.e("No validator results", new Object[0]);
                    }
                } else {
                    Timber.Companion companion = Timber.INSTANCE;
                    if (responseMakeServerCall != null) {
                        numValueOf = Integer.valueOf(responseMakeServerCall.code());
                    } else {
                        numValueOf = null;
                    }
                    companion.e("User validator network call was unsuccessful: " + numValueOf, new Object[0]);
                }
            } else {
                Timber.Companion companion2 = Timber.INSTANCE;
                if (responseMakeServerCall != null) {
                    numValueOf = Integer.valueOf(responseMakeServerCall.code());
                } else {
                    numValueOf = null;
                }
                companion2.e("User validator network call was unsuccessful: " + numValueOf, new Object[0]);
            }
            return null;
        } catch (Exception e) {
            ExtensionsKt.logNetworkError(e);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final List<WickrAPIObjects.WickrUser> loadDirectoryPage(int offset, int pageSize) {
        Timber.INSTANCE.i("Fetching directory contacts with page number " + offset + " and page size " + pageSize, new Object[0]);
        int i = offset / pageSize;
        Timber.INSTANCE.d("Directory page number: " + i, new Object[0]);
        DirectoryIndexResponse directoryIndexResponseBlockingGet = getSession().getNetworkClient().getWickrRestAPI().directoryIndex(new DirectoryIndexRequest(i, pageSize, getSession().getSessionID())).subscribeOn(Schedulers.io()).observeOn(Schedulers.io()).blockingGet();
        Intrinsics.checkNotNullExpressionValue(directoryIndexResponseBlockingGet, "blockingGet(...)");
        DirectoryIndexResponse directoryIndexResponse = directoryIndexResponseBlockingGet;
        Timber.INSTANCE.i("Received " + directoryIndexResponse.getUsers().size() + " directory users, with " + directoryIndexResponse.getTotalUserCount() + " total network users", new Object[0]);
        List<DirectoryUser> users = directoryIndexResponse.getUsers();
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(users, 10));
        Iterator<T> it = users.iterator();
        while (it.hasNext()) {
            arrayList.add(APIUtilsKt.toWickrAPIUser((DirectoryUser) it.next()));
        }
        ArrayList arrayList2 = new ArrayList();
        for (Object obj : arrayList) {
            if (!Intrinsics.areEqual(((WickrAPIObjects.WickrUser) obj).getId(), getSession().getUsernameHash())) {
                arrayList2.add(obj);
            }
        }
        return arrayList2;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void addToCache(String packageName, SearchResult user) {
        ConcurrentHashMap<String, HashMap<String, SearchResult>> concurrentHashMap = SEARCHED_USERS;
        HashMap<String, SearchResult> map = concurrentHashMap.get(packageName);
        if (map == null) {
            map = new HashMap<>();
        }
        map.put(user.getServerIDHash(), user);
        concurrentHashMap.put(packageName, map);
        Timber.INSTANCE.i("Added " + user.getServerIDHash() + " to the search cache", new Object[0]);
    }
}
