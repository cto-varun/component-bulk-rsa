import React, { Component, Fragment, useState, useEffect, useRef } from 'react';
import { Menu, Row, Col, Button, Typography, Modal, Upload, message , Spin} from 'antd';
import { LoadingOutlined, PlusOutlined, PaperClipOutlined,ExclamationCircleOutlined,CloseOutlined,CheckCircleOutlined } from '@ant-design/icons';
import { MessageBus } from '@ivoyant/component-message-bus';
import './styles.css';
import shortid from 'shortid';

export default function BulkRsa({
  visible,
  setShowBulkRSAModal,
  properties,
  datasources
}){
    const [ctns, setCtns] = useState([]);
    const [makeRequestDisabled, setMakeRequestDisabled] = useState(true);
    const [successResponse, setSuccessResponse] = useState();
    const [unsuccessfulCtns, setUnsuccessfulCtns] = useState([]);
    const [pending, setPending] = useState(false);
    const [showInstruction, setShowInstruction] = useState(true);
    const [fileInfo, setFileInfo] = useState();
    const [errorMessage, setErrorMessage] = useState();

    const ref = useRef();

    const antIcon = <LoadingOutlined className='loding-icon font-13' spin />;

    // function to handle csv file upload
    const handleChange = (csvFile) => {
          const file = csvFile;
          const reader = new FileReader();

          reader.onload = function(e) {
              const text = e.target.result;
              let textInCSV = text?.replaceAll(',', '').trim();
              if(textInCSV !== '')
              {
                processCSV(text);
                setShowInstruction(false)
              }
              else
              {
                setErrorMessage('Uploaded CSV file is empty.')
              }
          }
          if(file)
          {
            setFileInfo(file);
            setPending()
            reader.readAsText(file);
          }
          else
          {
            // if no file is selected then
            setMakeRequestDisabled(true);
            setCtns([]);
          }
      };

    // function to retry request for failed ctns only, after first request
    const retryAll = () =>
    {
      const newCtnList = unsuccessfulCtns?.map((ctnObj) =>{
        return {
          ctn : ctnObj?.ctn
        }
      });
      handleMakeRequest(newCtnList);
    }

    // function to send request for ctns
    const handleMakeRequest = (ctnList) => {
      setPending(true);
      setErrorMessage();
      const bulkRSAObject = {ctns : ctnList};
        const {
            workflow,
            datasource,
            successStates,
            errorStates,
            responseMapping,
        } = properties?.bulkRsaWorkflow;
        const registrationId = `${workflow}`;
        MessageBus.send('WF.'.concat(workflow).concat('.INIT'), {
            header: {
                registrationId: registrationId,
                workflow,
                eventType: 'INIT',
            },
        });
        MessageBus.subscribe(
            registrationId,
            'WF.'.concat(workflow).concat('.STATE.CHANGE'),
            handleResponse(successStates, errorStates)
        );
        MessageBus.send('WF.'.concat(workflow).concat('.SUBMIT'), {
            header: {
                registrationId: registrationId,
                workflow,
                eventType: 'SUBMIT',
            },
            body: {
                datasource: datasources[datasource],
                request: {
                    body: {
                        ...bulkRSAObject,
                    },
                },
                responseMapping,
            },
        });
    }

    // cancel the existing flow and close the modal
    const handleCancel = () => {
      setSuccessResponse();
      setUnsuccessfulCtns([]);
      setCtns([]);
      setShowInstruction(true);
      setShowBulkRSAModal(false);
      setMakeRequestDisabled(true);
      setErrorMessage();
      if(ref?.current?.value)
      {
        ref.current.value = "";
      }
    }

    const handleResponse = (successStates, errorStates) => (
      subscriptionId,
      topic,
      eventData,
      closure
  ) => {
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
          MessageBus.unsubscribe(subscriptionId);
      }
  };

  // before making request, function to check if data is in right format for bulk rsa
  const processCSV = (str, delim=',') => {
    let rows = str.split('\n');
    let filteredRows = [];
    let dataExistsInMultipleColumns = false;

    if(rows?.length > 0)
    {
      rows.forEach(row => {
        let rowItemsList = row?.split(',');
        let filteredRowItemsList = [];
        rowItemsList?.filter((item) => {
          let re = new RegExp(/^\d{10}$/); 
          if(re.test(item?.trim())) 
          {
            filteredRowItemsList?.push(item?.trim())
          }
        })

        if(filteredRowItemsList?.length > 1)
        {
          dataExistsInMultipleColumns = true;
          return null;
        }

        if(filteredRowItemsList?.length === 1)
        {
          filteredRows.push({
            ctn : filteredRowItemsList?.[0]
          });
        }
      });
    }

    if(dataExistsInMultipleColumns)
    {
      setErrorMessage('Uploaded CSV file has entries in multiple columns. Please add all CTNs in single column.');
      return null;
    }

    // function to remove dulpicate ctns from filteredRows
    const arrayUnique = (arr, uniqueKey) => {
      const flagList = new Set()
      return arr.filter(function(item) {
        if (!flagList.has(item[uniqueKey])) {
          flagList.add(item[uniqueKey])
          return true
        }
      })
    }

    if(filteredRows?.length > 0 && !dataExistsInMultipleColumns)
    {
          // remove duplicates
          const filtreredList = arrayUnique(filteredRows, 'ctn')
          setCtns(filtreredList);
          if(filtreredList?.length > 0)
          {
            setMakeRequestDisabled(false);
            setErrorMessage()
          }
    }
    else
      {
        setMakeRequestDisabled(true);
        setErrorMessage("Uploaded CSV file does not have any valid CTNs.")
      }
}

// remove failed ctns from list of unsuccessful ctns
const removeCtnFromList = (ctnObj) => {
    let newList = unsuccessfulCtns.filter((c) => c.ctn !== ctnObj.ctn);
    setUnsuccessfulCtns(newList)
}

// remove uploaded file
const removeFile = () => {
  setSuccessResponse();
  setUnsuccessfulCtns([]);
  setCtns([]);
  setShowInstruction(true);
  setMakeRequestDisabled(true);
  setFileInfo();
  setErrorMessage();
}

// to get the size from file infor eg. KB, MB, TB, GB
function formatBytes(bytes, decimals = 2) {
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
    authorization: 'authorization-text',
  },
  beforeUpload : function(file){
    handleChange(file)
  }
};

    return (
        <>
            <Modal 
                open={visible} 
                onOk={()=>setShowBulkRSAModal(false)} 
                onCancel={()=>setShowBulkRSAModal(false)}
                footer={null}
                centered
                closable={false}
                width={600}
            >

              {
                successResponse ? ( <>
                
                  <div>
                    <div className='font-15'><span className='success-count-text'>
                        < CheckCircleOutlined /> {successResponse?.successCount} Request Service Activations</span> completed successfully
                    </div>

                    <br />
                    <div>
                      {
                        unsuccessfulCtns?.length > 0 && (<div className='failed-request font-15'>
                         <ExclamationCircleOutlined /> Failed Requests
                        </div>)
                      }
                      <br />
                      {
                        unsuccessfulCtns?.length > 0 && (
                          <div className='ctn-response-list font-13'>
                            {
                              unsuccessfulCtns.map((obj, idx)=>{
                                return (
                                  <React.Fragment key={shortid.generate()}>
                                  <Row>
                                    <Col span={8}>{obj.ctn}</Col>
                                    <Col span={14} style={{paddingRight:'5px'}}>
                                      <span className='reason-text'>{obj.reason}</span>
                                      </Col>
                                    <Col span={2} style={{color:'#BFBFBF'}}><Button type="text" onClick={()=>removeCtnFromList(obj)}><CloseOutlined /></Button></Col>
                                  </Row>
                                  <br />
                                  </React.Fragment>
                                )
                              })
                            }
                          </div>
                        )
                      }
                      {
                        successResponse?.successCount === 0 && unsuccessfulCtns?.length === 0 && (
                              <div className='font-15'>
                                  No more CTNs available
                              </div>)
                      }
                    </div>
                  </div>
                  </>) : (
                <>
                {
                  showInstruction ? <>
                   <div className='title-upload-ctn'>
                        Upload a CTN list to Request Service Activation
                    </div>
                    <br />
                    <div className='intruction'>
                      File must contain less than 100 total CTNs. All numbers should be located in the same column
                    </div>
                    <br />
                  </> : <>
                  <div className='title-upload-ctn'>
                  Request Service Activation
                  </div>
                  <br />
                  </>
                }
                    <div>
                    {
                      makeRequestDisabled ? (

                        <div className='upload-wrapper'>
                            <Upload
                            ref={ref}
                            accept='.csv'
                            maxCount={1}
                            showUploadList={false}
                            {...props}>
                            <Button style={{width:'400px', 
                                          height:'50px', 
                                          padding:'10px',
                                          textAlign:'center',
                                          border:'1px dashed gray', 
                                          borderRadius:'40px',
                                          backgroundColor:'#F0F0F0',
                                          color:'black'}}>
                              <PaperClipOutlined className='primary-color' /> 
                              <span className='uplaod-btn-text'> Upload </span> {' '} 
                              in csv format.
                            </Button>
                        </Upload> 
                        </div>

                      ) : (
                        <>
                        <br />
                        <Row>
                          <Col className='file-info-container' span={pending ? 18 : 24}>
                            <Row>
                              <Col span={16}>{fileInfo?.name}</Col>
                              <Col span={6}>{formatBytes(fileInfo?.size)}</Col>
                              <Col span={2}><CloseOutlined onClick={removeFile}/></Col>
                            </Row>
                          </Col>
                          {pending &&  <Col span={6} className='padding-6'>
                              <span className='primary-color'> Loading <Spin indicator={antIcon} /></span>
                          </Col>}
                         
                        </Row>
                        </>
                      )
                    }
                    </div>
                </>
                ) 
              }


                 <div>
                   {
                     errorMessage && (<>
                     <br />
                      <p className="error-message">{errorMessage}</p>
                     </>)
                   }
                  <br />
                  <div>

                    {
                      successResponse && unsuccessfulCtns.length > 0 &&  <Button 
                      size='small' 
                      className="make-request-button"
                      onClick={retryAll}
                      disabled={pending}
                      style={{backgroundColor: makeRequestDisabled ? '#8C8C8C' : '#52C41B', color:'white'}}
                      >{pending && <span style={{color:'white'}}>
                        <Spin size="small" 
                        indicator={<LoadingOutlined className='retry-loading-icon font-13' style={{color:'white'}} spin />} />
                        </span>} RETRY ALL</Button>
                    }
                    {
                      !successResponse && <Button 
                      disabled={makeRequestDisabled || pending}
                      onClick={()=>handleMakeRequest(ctns)}
                      className="make-request-button"
                      size='small'
                      style={{backgroundColor: makeRequestDisabled ? '#8C8C8C' : '#52C41B', color:'white'}}
                    >
                      MAKE REQUEST
                    </Button>
                    }
                    <Button 
                    size='small'
                    className='cancel-button'
                    style={{backgroundColor:'#F0F0F0',color:'#8C8C8C', border:'none', fontSize:'13px', padding:'2px'}} 
                    onClick={handleCancel}>CANCEL</Button>
                  </div>
                </div>
            </Modal>
    
        </>
    )
}
