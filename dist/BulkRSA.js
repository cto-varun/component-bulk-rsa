"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = BulkRsa;
var _react = _interopRequireWildcard(require("react"));
var _antd = require("antd");
var _icons = require("@ant-design/icons");
var _componentMessageBus = require("@ivoyant/component-message-bus");
require("./styles.css");
var _shortid = _interopRequireDefault(require("shortid"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
function BulkRsa(_ref) {
  let {
    visible,
    setShowBulkRSAModal,
    properties,
    datasources
  } = _ref;
  const [ctns, setCtns] = (0, _react.useState)([]);
  const [makeRequestDisabled, setMakeRequestDisabled] = (0, _react.useState)(true);
  const [successResponse, setSuccessResponse] = (0, _react.useState)();
  const [unsuccessfulCtns, setUnsuccessfulCtns] = (0, _react.useState)([]);
  const [pending, setPending] = (0, _react.useState)(false);
  const [showInstruction, setShowInstruction] = (0, _react.useState)(true);
  const [fileInfo, setFileInfo] = (0, _react.useState)();
  const [errorMessage, setErrorMessage] = (0, _react.useState)();
  const ref = (0, _react.useRef)();
  const antIcon = /*#__PURE__*/_react.default.createElement(_icons.LoadingOutlined, {
    className: "loding-icon font-13",
    spin: true
  });

  // function to handle csv file upload
  const handleChange = csvFile => {
    const file = csvFile;
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      let textInCSV = text?.replaceAll(',', '').trim();
      if (textInCSV !== '') {
        processCSV(text);
        setShowInstruction(false);
      } else {
        setErrorMessage('Uploaded CSV file is empty.');
      }
    };
    if (file) {
      setFileInfo(file);
      setPending();
      reader.readAsText(file);
    } else {
      // if no file is selected then
      setMakeRequestDisabled(true);
      setCtns([]);
    }
  };

  // function to retry request for failed ctns only, after first request
  const retryAll = () => {
    const newCtnList = unsuccessfulCtns?.map(ctnObj => {
      return {
        ctn: ctnObj?.ctn
      };
    });
    handleMakeRequest(newCtnList);
  };

  // function to send request for ctns
  const handleMakeRequest = ctnList => {
    setPending(true);
    setErrorMessage();
    const bulkRSAObject = {
      ctns: ctnList
    };
    const {
      workflow,
      datasource,
      successStates,
      errorStates,
      responseMapping
    } = properties?.bulkRsaWorkflow;
    const registrationId = `${workflow}`;
    _componentMessageBus.MessageBus.send('WF.'.concat(workflow).concat('.INIT'), {
      header: {
        registrationId: registrationId,
        workflow,
        eventType: 'INIT'
      }
    });
    _componentMessageBus.MessageBus.subscribe(registrationId, 'WF.'.concat(workflow).concat('.STATE.CHANGE'), handleResponse(successStates, errorStates));
    _componentMessageBus.MessageBus.send('WF.'.concat(workflow).concat('.SUBMIT'), {
      header: {
        registrationId: registrationId,
        workflow,
        eventType: 'SUBMIT'
      },
      body: {
        datasource: datasources[datasource],
        request: {
          body: {
            ...bulkRSAObject
          }
        },
        responseMapping
      }
    });
  };

  // cancel the existing flow and close the modal
  const handleCancel = () => {
    setSuccessResponse();
    setUnsuccessfulCtns([]);
    setCtns([]);
    setShowInstruction(true);
    setShowBulkRSAModal(false);
    setMakeRequestDisabled(true);
    setErrorMessage();
    if (ref?.current?.value) {
      ref.current.value = "";
    }
  };
  const handleResponse = (successStates, errorStates) => (subscriptionId, topic, eventData, closure) => {
    const state = eventData.value;
    const isSuccess = successStates.includes(state);
    const isFailure = errorStates.includes(state);
    if (isSuccess || isFailure) {
      const response = eventData.event.data.data;
      if (isSuccess) {
        setSuccessResponse(response);
        setPending(false);
        setErrorMessage();
        setUnsuccessfulCtns(response.unsuccessfulCtns.length > 0 ? response.unsuccessfulCtns : []);
      }
      if (isFailure) {
        setErrorMessage(eventData.event.data.message || 'Error while requesting');
        setPending(false);
      }
      _componentMessageBus.MessageBus.unsubscribe(subscriptionId);
    }
  };

  // before making request, function to check if data is in right format for bulk rsa
  const processCSV = function (str) {
    let delim = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : ',';
    let rows = str.split('\n');
    let filteredRows = [];
    let dataExistsInMultipleColumns = false;
    if (rows?.length > 0) {
      rows.forEach(row => {
        let rowItemsList = row?.split(',');
        let filteredRowItemsList = [];
        rowItemsList?.filter(item => {
          let re = new RegExp(/^\d{10}$/);
          if (re.test(item?.trim())) {
            filteredRowItemsList?.push(item?.trim());
          }
        });
        if (filteredRowItemsList?.length > 1) {
          dataExistsInMultipleColumns = true;
          return null;
        }
        if (filteredRowItemsList?.length === 1) {
          filteredRows.push({
            ctn: filteredRowItemsList?.[0]
          });
        }
      });
    }
    if (dataExistsInMultipleColumns) {
      setErrorMessage('Uploaded CSV file has entries in multiple columns. Please add all CTNs in single column.');
      return null;
    }

    // function to remove dulpicate ctns from filteredRows
    const arrayUnique = (arr, uniqueKey) => {
      const flagList = new Set();
      return arr.filter(function (item) {
        if (!flagList.has(item[uniqueKey])) {
          flagList.add(item[uniqueKey]);
          return true;
        }
      });
    };
    if (filteredRows?.length > 0 && !dataExistsInMultipleColumns) {
      // remove duplicates
      const filtreredList = arrayUnique(filteredRows, 'ctn');
      setCtns(filtreredList);
      if (filtreredList?.length > 0) {
        setMakeRequestDisabled(false);
        setErrorMessage();
      }
    } else {
      setMakeRequestDisabled(true);
      setErrorMessage("Uploaded CSV file does not have any valid CTNs.");
    }
  };

  // remove failed ctns from list of unsuccessful ctns
  const removeCtnFromList = ctnObj => {
    let newList = unsuccessfulCtns.filter(c => c.ctn !== ctnObj.ctn);
    setUnsuccessfulCtns(newList);
  };

  // remove uploaded file
  const removeFile = () => {
    setSuccessResponse();
    setUnsuccessfulCtns([]);
    setCtns([]);
    setShowInstruction(true);
    setMakeRequestDisabled(true);
    setFileInfo();
    setErrorMessage();
  };

  // to get the size from file infor eg. KB, MB, TB, GB
  function formatBytes(bytes) {
    let decimals = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  const props = {
    name: 'file',
    headers: {
      authorization: 'authorization-text'
    },
    beforeUpload: function (file) {
      handleChange(file);
    }
  };
  return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement(_antd.Modal, {
    open: visible,
    onOk: () => setShowBulkRSAModal(false),
    onCancel: () => setShowBulkRSAModal(false),
    footer: null,
    centered: true,
    closable: false,
    width: 600
  }, successResponse ? /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("div", null, /*#__PURE__*/_react.default.createElement("div", {
    className: "font-15"
  }, /*#__PURE__*/_react.default.createElement("span", {
    className: "success-count-text"
  }, /*#__PURE__*/_react.default.createElement(_icons.CheckCircleOutlined, null), " ", successResponse?.successCount, " Request Service Activations"), " completed successfully"), /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("div", null, unsuccessfulCtns?.length > 0 && /*#__PURE__*/_react.default.createElement("div", {
    className: "failed-request font-15"
  }, /*#__PURE__*/_react.default.createElement(_icons.ExclamationCircleOutlined, null), " Failed Requests"), /*#__PURE__*/_react.default.createElement("br", null), unsuccessfulCtns?.length > 0 && /*#__PURE__*/_react.default.createElement("div", {
    className: "ctn-response-list font-13"
  }, unsuccessfulCtns.map((obj, idx) => {
    return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, {
      key: _shortid.default.generate()
    }, /*#__PURE__*/_react.default.createElement(_antd.Row, null, /*#__PURE__*/_react.default.createElement(_antd.Col, {
      span: 8
    }, obj.ctn), /*#__PURE__*/_react.default.createElement(_antd.Col, {
      span: 14,
      style: {
        paddingRight: '5px'
      }
    }, /*#__PURE__*/_react.default.createElement("span", {
      className: "reason-text"
    }, obj.reason)), /*#__PURE__*/_react.default.createElement(_antd.Col, {
      span: 2,
      style: {
        color: '#BFBFBF'
      }
    }, /*#__PURE__*/_react.default.createElement(_antd.Button, {
      type: "text",
      onClick: () => removeCtnFromList(obj)
    }, /*#__PURE__*/_react.default.createElement(_icons.CloseOutlined, null)))), /*#__PURE__*/_react.default.createElement("br", null));
  })), successResponse?.successCount === 0 && unsuccessfulCtns?.length === 0 && /*#__PURE__*/_react.default.createElement("div", {
    className: "font-15"
  }, "No more CTNs available")))) : /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, showInstruction ? /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("div", {
    className: "title-upload-ctn"
  }, "Upload a CTN list to Request Service Activation"), /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("div", {
    className: "intruction"
  }, "File must contain less than 100 total CTNs. All numbers should be located in the same column"), /*#__PURE__*/_react.default.createElement("br", null)) : /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("div", {
    className: "title-upload-ctn"
  }, "Request Service Activation"), /*#__PURE__*/_react.default.createElement("br", null)), /*#__PURE__*/_react.default.createElement("div", null, makeRequestDisabled ? /*#__PURE__*/_react.default.createElement("div", {
    className: "upload-wrapper"
  }, /*#__PURE__*/_react.default.createElement(_antd.Upload, _extends({
    ref: ref,
    accept: ".csv",
    maxCount: 1,
    showUploadList: false
  }, props), /*#__PURE__*/_react.default.createElement(_antd.Button, {
    style: {
      width: '400px',
      height: '50px',
      padding: '10px',
      textAlign: 'center',
      border: '1px dashed gray',
      borderRadius: '40px',
      backgroundColor: '#F0F0F0',
      color: 'black'
    }
  }, /*#__PURE__*/_react.default.createElement(_icons.PaperClipOutlined, {
    className: "primary-color"
  }), /*#__PURE__*/_react.default.createElement("span", {
    className: "uplaod-btn-text"
  }, " Upload "), " ", ' ', "in csv format."))) : /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement(_antd.Row, null, /*#__PURE__*/_react.default.createElement(_antd.Col, {
    className: "file-info-container",
    span: pending ? 18 : 24
  }, /*#__PURE__*/_react.default.createElement(_antd.Row, null, /*#__PURE__*/_react.default.createElement(_antd.Col, {
    span: 16
  }, fileInfo?.name), /*#__PURE__*/_react.default.createElement(_antd.Col, {
    span: 6
  }, formatBytes(fileInfo?.size)), /*#__PURE__*/_react.default.createElement(_antd.Col, {
    span: 2
  }, /*#__PURE__*/_react.default.createElement(_icons.CloseOutlined, {
    onClick: removeFile
  })))), pending && /*#__PURE__*/_react.default.createElement(_antd.Col, {
    span: 6,
    className: "padding-6"
  }, /*#__PURE__*/_react.default.createElement("span", {
    className: "primary-color"
  }, " Loading ", /*#__PURE__*/_react.default.createElement(_antd.Spin, {
    indicator: antIcon
  }))))))), /*#__PURE__*/_react.default.createElement("div", null, errorMessage && /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("p", {
    className: "error-message"
  }, errorMessage)), /*#__PURE__*/_react.default.createElement("br", null), /*#__PURE__*/_react.default.createElement("div", null, successResponse && unsuccessfulCtns.length > 0 && /*#__PURE__*/_react.default.createElement(_antd.Button, {
    size: "small",
    className: "make-request-button",
    onClick: retryAll,
    disabled: pending,
    style: {
      backgroundColor: makeRequestDisabled ? '#8C8C8C' : '#52C41B',
      color: 'white'
    }
  }, pending && /*#__PURE__*/_react.default.createElement("span", {
    style: {
      color: 'white'
    }
  }, /*#__PURE__*/_react.default.createElement(_antd.Spin, {
    size: "small",
    indicator: /*#__PURE__*/_react.default.createElement(_icons.LoadingOutlined, {
      className: "retry-loading-icon font-13",
      style: {
        color: 'white'
      },
      spin: true
    })
  })), " RETRY ALL"), !successResponse && /*#__PURE__*/_react.default.createElement(_antd.Button, {
    disabled: makeRequestDisabled || pending,
    onClick: () => handleMakeRequest(ctns),
    className: "make-request-button",
    size: "small",
    style: {
      backgroundColor: makeRequestDisabled ? '#8C8C8C' : '#52C41B',
      color: 'white'
    }
  }, "MAKE REQUEST"), /*#__PURE__*/_react.default.createElement(_antd.Button, {
    size: "small",
    className: "cancel-button",
    style: {
      backgroundColor: '#F0F0F0',
      color: '#8C8C8C',
      border: 'none',
      fontSize: '13px',
      padding: '2px'
    },
    onClick: handleCancel
  }, "CANCEL")))));
}
module.exports = exports.default;