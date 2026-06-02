"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_GROUP = exports.WEBIM = exports.PANTOKEN = exports.ACCOUNTMANAGE = exports.ACTIVELIST = exports.COURSELIST = exports.PPTACTIVEINFO = exports.PPTSIGN = exports.ANALYSIS2 = exports.ANALYSIS = exports.PRESIGN = exports.LOGIN = void 0;
exports.LOGIN = {
    URL: 'https://passport2.chaoxing.com/fanyalogin',
    METHOD: 'POST',
};
exports.PRESIGN = {
    URL: 'https://mobilelearn.chaoxing.com/newsign/preSign',
    METHOD: 'GET'
};
exports.ANALYSIS = {
    URL: 'https://mobilelearn.chaoxing.com/pptSign/analysis',
    METHOD: 'GET'
};
exports.ANALYSIS2 = {
    URL: 'https://mobilelearn.chaoxing.com/pptSign/analysis2',
    METHOD: 'GET'
};
exports.PPTSIGN = {
    URL: 'https://mobilelearn.chaoxing.com/pptSign/stuSignajax',
    METHOD: 'GET'
};
exports.PPTACTIVEINFO = {
    URL: 'https://mobilelearn.chaoxing.com/v2/apis/active/getPPTActiveInfo',
    METHOD: 'GET'
};
exports.COURSELIST = {
    URL: 'https://mooc1-1.chaoxing.com/visit/courselistdata',
    METHOD: 'POST'
};
exports.ACTIVELIST = {
    URL: 'https://mobilelearn.chaoxing.com/v2/apis/active/student/activelist',
    METHOD: 'GET'
};
exports.ACCOUNTMANAGE = {
    URL: 'https://passport2.chaoxing.com/mooc/accountManage',
    METHOD: 'GET'
};
exports.PANTOKEN = {
    URL: 'https://pan-yz.chaoxing.com/api/token/uservalid',
    METHOD: 'GET'
};
exports.WEBIM = {
    URL: 'https://im.chaoxing.com/webim/me',
    METHOD: 'GET'
};
// 无课程的群聊的一些 API
exports.CHAT_GROUP = {
    PRESTUSIGN: {
        URL: 'https://mobilelearn.chaoxing.com/sign/preStuSign',
        METHOD: 'GET'
    },
    SIGN: {
        URL: 'https://mobilelearn.chaoxing.com/sign/stuSignajax',
        // 也存在是 POST 的情况
        METHOD: 'GET'
    }
};
