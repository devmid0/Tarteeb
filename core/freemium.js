'use strict';

var FREE_LIMITS = {
    projects: 3,
    habits: 5,
};

export function canCreateEntity(entityType, currentCount) {
    if (localStorage.getItem('tarteeb_premium') === 'true') return true;
    var limit = FREE_LIMITS[entityType];
    return limit === undefined || currentCount < limit;
}

export function showPaywall() {
    import('./composites/cloud-sync.js').then(function (mod) {
        mod.showPaywall();
    });
}
