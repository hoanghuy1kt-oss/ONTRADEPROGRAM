document.addEventListener('DOMContentLoaded', () => {
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyD_1OIJWVUGK7pNKeB8dyzGQeRInMP7eLg",
    authDomain: "ontrade-contrated.firebaseapp.com",
    projectId: "ontrade-contrated",
    storageBucket: "ontrade-contrated.firebasestorage.app",
    messagingSenderId: "762326081844",
    appId: "1:762326081844:web:0dd4a160f2249b67f80561",
    measurementId: "G-3GGY7R5NYF"
  };

  let db, storage;
  let useFirebase = false;

  if (typeof firebase !== 'undefined' && firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      storage = firebase.storage();
      useFirebase = true;
      console.log("Firebase Cloud storage enabled!");
    } catch (e) {
      console.error("Firebase error, falling back to local storage:", e);
    }
  }

  // One-time localStorage wipe to clear old mock data (programs and reports)
  if (!localStorage.getItem('diageo_data_wiped_v2')) {
    localStorage.removeItem('diageo_reports');
    localStorage.removeItem('diageo_programs');
    localStorage.setItem('diageo_data_wiped_v2', 'true');
    console.log("Old Diageo mock data wiped from localStorage.");
  }

  // DOM Elements
  const form = document.getElementById('activationForm');
  const btnBack = document.getElementById('btnBack');
  const btnNext = document.getElementById('btnNext');
  const successOverlay = document.getElementById('successOverlay');
  const btnReset = document.getElementById('btnReset');
  const stepNumberBadge = document.getElementById('stepNumberBadge');
  const currentStepLabel = document.getElementById('currentStepLabel');
  const stepCapsules = document.querySelectorAll('.step-capsule');
  const formSteps = document.querySelectorAll('.form-step');
  
  // Accordion T&C
  const infoAccordion = document.getElementById('infoAccordion');
  const accordionHeader = document.getElementById('accordionHeader');
  
  // File Upload Elements
  const uploadZone = document.getElementById('uploadZone');
  const imageFilesInput = document.getElementById('imageFiles');
  const previewGrid = document.getElementById('previewGrid');
  const counterText = document.getElementById('counterText');
  const counterBadge = document.getElementById('counterBadge');
  const galleryError = document.getElementById('gallery-error');
  
  // Toast Container
  const toastContainer = document.getElementById('toastContainer');
  
  // State variables
  let currentStep = 1;
  let totalSteps = 3;
  let uploadedImages = []; // Backing state for files
  let uploadedImagesDisplay1 = []; // Toàn cảnh
  let uploadedImagesDisplay2 = []; // Mặt chính
  let uploadedImagesDisplay3 = []; // Khu trưng bày
  let eventGalleryControl, displayGallery1Control, displayGallery2Control, displayGallery3Control;

  // Autocomplete and database variables
  const outletNameInput = document.getElementById('outletName');
  const programNameInput = document.getElementById('programName');
  const eventFieldsContainer = document.getElementById('eventFieldsContainer');
  const autocompleteList = document.getElementById('autocompleteList');
  let activeItemIndex = -1;

  let samplePrograms = [];

  function initPrograms() {
    if (useFirebase) {
      db.collection('programs').orderBy('name').onSnapshot((snapshot) => {
        samplePrograms = [];
        snapshot.forEach((doc) => {
          samplePrograms.push(doc.data().name);
        });
        renderProgramCrudList();
      });
    } else {
      const stored = localStorage.getItem('diageo_programs');
      if (stored) {
        samplePrograms = JSON.parse(stored);
      } else {
        samplePrograms = [];
        localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
      }
    }
  }

  let reports = [];

  function initReports() {
    if (useFirebase) {
      db.collection('reports').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
        reports = [];
        snapshot.forEach((doc) => {
          reports.push(doc.data());
        });
        renderReportsTable();
      }, (error) => {
        console.error("Firestore reports sync error:", error);
      });
    } else {
      const stored = localStorage.getItem('diageo_reports');
      if (stored) {
        reports = JSON.parse(stored);
      } else {
        reports = [];
        localStorage.setItem('diageo_reports', JSON.stringify(reports));
      }
      renderReportsTable();
    }
  }
  
  // 1. Accordion Toggle (Removed - Always Shown)
  // ----------------------------------------------------

  // ----------------------------------------------------
  // 1b. Searchable Autocomplete Dropdown
  // ----------------------------------------------------
  function renderAutocomplete(filterText = '') {
    autocompleteList.innerHTML = '';
    activeItemIndex = -1;

    const filtered = samplePrograms.filter(prog => 
      prog.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'autocomplete-no-results';
      emptyDiv.textContent = 'Không tìm thấy chương trình nào...';
      autocompleteList.appendChild(emptyDiv);
    } else {
      filtered.forEach((prog, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = prog;
        item.dataset.index = index;

        item.addEventListener('click', () => {
          selectProgram(prog);
        });

        autocompleteList.appendChild(item);
      });
    }
    autocompleteList.style.display = 'block';
  }

  function selectProgram(name) {
    outletNameInput.value = name;
    autocompleteList.style.display = 'none';
    clearError('group-outlet-name');
  }

  outletNameInput.addEventListener('focus', () => {
    renderAutocomplete(outletNameInput.value);
  });

  outletNameInput.addEventListener('input', () => {
    renderAutocomplete(outletNameInput.value);
    if (outletNameInput.value.trim().length >= 1) {
      clearError('group-outlet-name');
    }
  });

  outletNameInput.addEventListener('keydown', (e) => {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    if (autocompleteList.style.display !== 'block' || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeItemIndex = (activeItemIndex + 1) % items.length;
      highlightItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeItemIndex = (activeItemIndex - 1 + items.length) % items.length;
      highlightItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeItemIndex > -1 && items[activeItemIndex]) {
        selectProgram(items[activeItemIndex].textContent);
      }
    } else if (e.key === 'Escape') {
      autocompleteList.style.display = 'none';
    }
  });

  function highlightItem(items) {
    items.forEach((item, index) => {
      if (index === activeItemIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!outletNameInput.contains(e.target) && !autocompleteList.contains(e.target)) {
      autocompleteList.style.display = 'none';
    }
  });
  
  // ----------------------------------------------------
  // 2. Custom Selector Card Event Listeners (Sync check/radio UI)
  // ----------------------------------------------------
  // Checkbox interactions
  const checkboxInputs = document.querySelectorAll('.checkbox-card input[type="checkbox"]');
  checkboxInputs.forEach(input => {
    const card = input.closest('.selector-card');
    
    // Sync initial state
    if (input.checked) {
      card.classList.add('checked');
    }
    
    input.addEventListener('change', () => {
      if (input.checked) {
        card.classList.add('checked');
        clearError('group-event-type');
      } else {
        card.classList.remove('checked');
      }
    });
  });

  // Radio interactions (Activity Type: Event/Display)
  const activityTypeInputs = document.querySelectorAll('input[name="activityType"]');
  activityTypeInputs.forEach(input => {
    const card = input.closest('.selector-card');
    
    // Sync initial state
    if (input.checked) {
      card.classList.add('checked');
    }

    input.addEventListener('change', () => {
      // Uncheck other radio cards in the group
      activityTypeInputs.forEach(otherInput => {
        otherInput.closest('.selector-card').classList.remove('checked');
      });
      
      // Check current
      if (input.checked) {
        card.classList.add('checked');
        handleActivityTypeChange(input.value);
      }
    });
  });

  function handleActivityTypeChange(type) {
    const labelSlot3 = document.getElementById('labelSlot3');
    const descSlot3 = document.getElementById('descSlot3');
    const uploadTitleSlot3 = document.getElementById('uploadTitleSlot3');
    const uploadBtnSlot3 = document.getElementById('uploadBtnSlot3');

    if (type === 'Display') {
      eventFieldsContainer.style.display = 'none';
      totalSteps = 2;
      document.querySelector('[data-target-step="2"]').style.display = 'none';
      
      if (labelSlot3) labelSlot3.innerHTML = '3. Ảnh khu trưng bày <span class="required">*</span>';
      if (descSlot3) descSlot3.textContent = 'Chụp cận cảnh quầy kệ/khu trưng bày sản phẩm Diageo (tối thiểu 2 ảnh, có thể chụp nhiều hơn).';
      if (uploadTitleSlot3) uploadTitleSlot3.textContent = 'Kéo & thả ảnh trưng bày vào đây';
      if (uploadBtnSlot3) uploadBtnSlot3.innerHTML = '<i class="fa-regular fa-images"></i> Chọn ảnh trưng bày';
    } else {
      eventFieldsContainer.style.display = 'block';
      totalSteps = 3;
      document.querySelector('[data-target-step="2"]').style.display = 'flex';
      
      if (labelSlot3) labelSlot3.innerHTML = '3. Ảnh Sự kiện/Activation <span class="required">*</span>';
      if (descSlot3) descSlot3.textContent = 'Chụp cận cảnh hình ảnh sự kiện, hoạt động liên quan đến sản phẩm Diageo (tối thiểu 2 ảnh, có thể chụp nhiều hơn).';
      if (uploadTitleSlot3) uploadTitleSlot3.textContent = 'Kéo & thả ảnh sự kiện vào đây';
      if (uploadBtnSlot3) uploadBtnSlot3.innerHTML = '<i class="fa-regular fa-images"></i> Chọn ảnh sự kiện';
    }
    
    currentStep = 1;
    updateStepUI();
  }

  // Radio interactions (Tôi cam đoan)
  const radioInputs = document.querySelectorAll('input[name="guarantee"]');
  radioInputs.forEach(input => {
    const card = input.closest('.selector-card');
    
    input.addEventListener('change', () => {
      // Uncheck all other radio cards in the group
      radioInputs.forEach(otherInput => {
        otherInput.closest('.selector-card').classList.remove('checked');
      });
      
      // Check current
      if (input.checked) {
        card.classList.add('checked');
        clearError('group-guarantee');
      }
    });
  });

  // ----------------------------------------------------
  // 3. Multi-Step Form Navigation & Progress
  // ----------------------------------------------------
  function updateStepUI() {
    const isDisplay = document.querySelector('input[name="activityType"]:checked').value === 'Display';
    
    // Hide all steps, show active step based on type
    formSteps.forEach(step => {
      step.classList.remove('active');
      const stepNum = parseInt(step.dataset.step);
      
      if (isDisplay) {
        if (currentStep === 1 && stepNum === 1) {
          step.classList.add('active');
        } else if (currentStep === 2 && stepNum === 3) {
          step.classList.add('active');
        }
      } else {
        if (stepNum === currentStep) {
          step.classList.add('active');
        }
      }
    });
    
    // Update Stepper capsules classes
    stepCapsules.forEach(capsule => {
      const targetStep = parseInt(capsule.dataset.targetStep);
      capsule.classList.remove('active', 'completed');
      
      if (isDisplay) {
        if (targetStep === 1) {
          if (currentStep === 1) capsule.classList.add('active');
          else capsule.classList.add('completed');
        } else if (targetStep === 3) {
          if (currentStep === 2) capsule.classList.add('active');
        }
      } else {
        if (targetStep === currentStep) {
          capsule.classList.add('active');
        } else if (targetStep < currentStep) {
          capsule.classList.add('completed');
        }
      }
    });

    // Update Step labels
    stepNumberBadge.textContent = `Bước ${currentStep}/${totalSteps}`;
    
    let stepName = '';
    if (isDisplay) {
      if (currentStep === 1) stepName = 'Thông tin chung';
      else if (currentStep === 2) stepName = 'Minh chứng';
    } else {
      if (currentStep === 1) stepName = 'Thông tin chung';
      else if (currentStep === 2) stepName = 'Loại hình sự kiện';
      else if (currentStep === 3) stepName = 'Minh chứng';
    }
    currentStepLabel.textContent = stepName;
    
    // Update footer buttons visibility & text
    if (currentStep === 1) {
      btnBack.style.visibility = 'hidden';
    } else {
      btnBack.style.visibility = 'visible';
    }
    
    if (currentStep === totalSteps) {
      btnNext.querySelector('.btn-text').textContent = 'Gửi báo cáo';
      btnNext.querySelector('.btn-icon-right').className = 'fa-solid fa-paper-plane btn-icon-right';
    } else {
      btnNext.querySelector('.btn-text').textContent = 'Tiếp theo';
      btnNext.querySelector('.btn-icon-right').className = 'fa-solid fa-arrow-right btn-icon-right';
    }
    
    // Scroll smoothly to form top on mobile
    window.scrollTo({
      top: document.querySelector('.form-card').offsetTop - 20,
      behavior: 'smooth'
    });
  }
  
  btnNext.addEventListener('click', () => {
    // Validate current step before advancing
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        currentStep++;
        updateStepUI();
      } else {
        submitForm();
      }
    } else {
      showToast('Lỗi nhập liệu', 'Vui lòng kiểm tra lại các thông tin bắt buộc.', 'error');
    }
  });
  
  btnBack.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateStepUI();
    }
  });

  // Enable navigation by clicking completed steps directly
  stepCapsules.forEach(capsule => {
    capsule.addEventListener('click', () => {
      const isDisplay = document.querySelector('input[name="activityType"]:checked').value === 'Display';
      let targetStep = parseInt(capsule.dataset.targetStep);
      
      if (isDisplay) {
        if (targetStep === 2) return; // skip step 2 for Display flow
        if (targetStep === 3) targetStep = 2; // map HTML step 3 to step 2 in Display flow
      }
      
      // Only allow navigating backwards or to steps that have already been validated
      if (targetStep < currentStep) {
        currentStep = targetStep;
        updateStepUI();
      } else if (targetStep > currentStep) {
        // Run validations sequentially
        let canAdvance = true;
        for (let s = currentStep; s < targetStep; s++) {
          if (!validateStep(s)) {
            canAdvance = false;
            break;
          }
        }
        if (canAdvance) {
          currentStep = targetStep;
          updateStepUI();
        } else {
          showToast('Lỗi nhập liệu', 'Bạn cần hoàn thành chính xác bước hiện tại trước.', 'error');
        }
      }
    });
  });

  // ----------------------------------------------------
  // 4. Form Validation Engine
  // ----------------------------------------------------
  function showError(groupId, message) {
    const group = document.getElementById(groupId);
    if (!group) return;
    
    group.classList.add('has-error');
    const errorEl = group.querySelector('.error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'flex';
    }
  }
  
  function clearError(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    
    group.classList.remove('has-error');
    const errorEl = group.querySelector('.error-message');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }
  
  function validateStep(step) {
    let isValid = true;
    const isDisplay = document.querySelector('input[name="activityType"]:checked').value === 'Display';
    
    if (step === 1) {
      // Validate Outlet Name
      const outletName = document.getElementById('outletName');
      if (!outletName.value.trim()) {
        showError('group-outlet-name', 'Tên Outlet không được để trống.');
        isValid = false;
      } else {
        clearError('group-outlet-name');
      }

      // Only validate event fields if NOT Display
      if (!isDisplay) {
        // Validate Program Name
        const programName = document.getElementById('programName');
        if (!programName.value.trim()) {
          showError('group-program-name', 'Tên chương trình không được để trống.');
          isValid = false;
        } else if (programName.value.trim().length < 5) {
          showError('group-program-name', 'Tên chương trình phải có tối thiểu 5 ký tự.');
          isValid = false;
        } else {
          clearError('group-program-name');
        }
        
        // Validate Start & End Dates
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        
        if (!startDate.value) {
          showError('group-start-date', 'Vui lòng chọn ngày bắt đầu.');
          isValid = false;
        } else {
          clearError('group-start-date');
        }
        
        if (!endDate.value) {
          showError('group-end-date', 'Vui lòng chọn ngày kết thúc.');
          isValid = false;
        } else {
          clearError('group-end-date');
        }
        
        if (startDate.value && endDate.value) {
          const start = new Date(startDate.value);
          const end = new Date(endDate.value);
          if (start > end) {
            showError('group-end-date', 'Ngày kết thúc phải diễn ra sau ngày bắt đầu.');
            isValid = false;
          } else {
            clearError('group-end-date');
          }
        }
      }
    }
    
    else if (step === 2 && !isDisplay) {
      // Validate Event Type Checkboxes (At least one checked)
      const checkedTypes = document.querySelectorAll('input[name="eventType"]:checked');
      if (checkedTypes.length === 0) {
        showError('group-event-type', 'Vui lòng chọn ít nhất một loại hình hoạt động.');
        isValid = false;
      } else {
        clearError('group-event-type');
      }
    }
    
    else if ((step === 3 && !isDisplay) || (step === 2 && isDisplay)) {
      let isDisplayImagesValid = true;
      
      // Validate Slot 1: Toàn cảnh (min 1)
      if (uploadedImagesDisplay1.length < 1) {
        showError('group-gallery-display1', 'Cần tải lên tối thiểu 1 ảnh toàn cảnh cửa hàng có địa chỉ.');
        isDisplayImagesValid = false;
      } else {
        clearError('group-gallery-display1');
      }
      
      // Validate Slot 2: Mặt chính (min 1)
      if (uploadedImagesDisplay2.length < 1) {
        showError('group-gallery-display2', 'Cần tải lên tối thiểu 1 ảnh mặt chính của cửa hàng.');
        isDisplayImagesValid = false;
      } else {
        clearError('group-gallery-display2');
      }
      
      // Validate Slot 3: Khu trưng bày / Sự kiện (min 2)
      if (uploadedImagesDisplay3.length < 2) {
        const errorMsg = isDisplay ? 'Cần tải lên tối thiểu 2 ảnh khu trưng bày có sản phẩm.' : 'Cần tải lên tối thiểu 2 ảnh sự kiện/activation.';
        showError('group-gallery-display3', errorMsg);
        isDisplayImagesValid = false;
      } else {
        clearError('group-gallery-display3');
      }
      
      if (!isDisplayImagesValid) {
        isValid = false;
      }
      
      // Validate Guarantee Radio
      const checkedGuarantee = document.querySelector('input[name="guarantee"]:checked');
      if (!checkedGuarantee) {
        showError('group-guarantee', 'Vui lòng xác nhận cam đoan thông tin.');
        isValid = false;
      } else {
        clearError('group-guarantee');
      }
    }
    
    return isValid;
  }
  
  // Real-time input validation listeners for dates
  
  document.getElementById('startDate').addEventListener('change', () => {
    clearError('group-start-date');
    const endDate = document.getElementById('endDate');
    if (endDate.value) {
      const start = new Date(document.getElementById('startDate').value);
      const end = new Date(endDate.value);
      if (start <= end) {
        clearError('group-end-date');
      }
    }
  });
  
  document.getElementById('endDate').addEventListener('change', () => {
    clearError('group-end-date');
  });

  // ----------------------------------------------------
  // 5. Drag & Drop File Upload and Preview Management
  // ----------------------------------------------------
  // 5. Drag & Drop File Upload and Preview Management
  // ----------------------------------------------------
  function setupUploadZone(zoneId, inputId, filesStore, counterTextId, counterBadgeId, previewGridId, groupId, minCount) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const counterText = document.getElementById(counterTextId);
    const counterBadge = document.getElementById(counterBadgeId);
    const previewGrid = document.getElementById(previewGridId);

    if (!zone || !input) return null;

    zone.addEventListener('click', () => {
      input.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
      }, false);
    });

    zone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleFiles(files);
    });

    input.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    function handleFiles(files) {
      if (files.length === 0) return;
      let addedCount = 0;
      let ignoredCount = 0;

      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const isDuplicate = filesStore.some(img => img.name === file.name && img.size === file.size);
          if (!isDuplicate) {
            filesStore.push(file);
            addedCount++;
          } else {
            ignoredCount++;
          }
        } else {
          ignoredCount++;
        }
      });

      if (addedCount > 0) {
        showToast('Đã thêm ảnh', `Tải lên thành công ${addedCount} ảnh.`, 'info');
        renderPreviews();
        
        const isDisplay = document.querySelector('input[name="activityType"]:checked').value === 'Display';
        const finalStep = isDisplay ? 2 : 3;
        if (currentStep === finalStep) {
          validateStep(finalStep);
        }
      }
      if (ignoredCount > 0) {
        showToast('Bỏ qua tệp', `${ignoredCount} tệp không hợp lệ hoặc đã trùng lặp.`, 'warning');
      }
      input.value = '';
    }

    function renderPreviews() {
      previewGrid.innerHTML = '';
      if (filesStore.length === 0) {
        counterText.textContent = 'Chưa tải ảnh lên';
        counterBadge.textContent = '0 ảnh';
        counterBadge.className = 'counter-badge';
        return;
      }

      counterText.textContent = `Đã tải lên ${filesStore.length} ảnh`;
      counterBadge.textContent = `${filesStore.length} ảnh`;

      if (filesStore.length >= minCount) {
        counterBadge.className = 'counter-badge success-badge';
      } else {
        counterBadge.className = 'counter-badge';
      }

      filesStore.forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';

        const img = document.createElement('img');
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.alt = file.name;
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
        };

        const overlay = document.createElement('div');
        overlay.className = 'preview-item-overlay';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'preview-delete-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.title = 'Xóa ảnh này';

        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          filesStore.splice(index, 1);
          renderPreviews();
          showToast('Đã xóa ảnh', 'Đã gỡ bỏ ảnh.', 'info');
          
          const isDisplay = document.querySelector('input[name="activityType"]:checked').value === 'Display';
          const finalStep = isDisplay ? 2 : 3;
          if (currentStep === finalStep) {
            validateStep(finalStep);
          }
        });

        overlay.appendChild(deleteBtn);
        previewItem.appendChild(img);
        previewItem.appendChild(overlay);
        previewGrid.appendChild(previewItem);
      });
    }

    return {
      render: renderPreviews,
      clear: () => {
        filesStore.length = 0;
        renderPreviews();
      }
    };
  }

  // Initialize upload zones
  eventGalleryControl = setupUploadZone(
    'uploadZone',
    'imageFiles',
    uploadedImages,
    'counterText',
    'counterBadge',
    'previewGrid',
    'group-gallery',
    4
  );

  displayGallery1Control = setupUploadZone(
    'uploadZoneDisplay1',
    'imageFilesDisplay1',
    uploadedImagesDisplay1,
    'counterTextDisplay1',
    'counterBadgeDisplay1',
    'previewGridDisplay1',
    'group-gallery-display1',
    1
  );

  displayGallery2Control = setupUploadZone(
    'uploadZoneDisplay2',
    'imageFilesDisplay2',
    uploadedImagesDisplay2,
    'counterTextDisplay2',
    'counterBadgeDisplay2',
    'previewGridDisplay2',
    'group-gallery-display2',
    1
  );

  displayGallery3Control = setupUploadZone(
    'uploadZoneDisplay3',
    'imageFilesDisplay3',
    uploadedImagesDisplay3,
    'counterTextDisplay3',
    'counterBadgeDisplay3',
    'previewGridDisplay3',
    'group-gallery-display3',
    2
  );

  // ----------------------------------------------------
  // 6. Toast System
  // ----------------------------------------------------
  function showToast(title, message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
    if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';
    
    toast.innerHTML = `
      <i class="${iconClass} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button type="button" class="toast-close"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      removeToast(toast);
    });
    
    // Auto remove
    const timer = setTimeout(() => {
      removeToast(toast);
    }, duration);
    
    // Store timer on element to clear if closed early
    toast.dataset.timerId = timer;
  }
  
  function removeToast(toast) {
    if (toast.classList.contains('removing')) return;
    
    // Clear auto-remove timeout
    if (toast.dataset.timerId) {
      clearTimeout(parseInt(toast.dataset.timerId));
    }
    
    toast.classList.add('removing');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }

  // ----------------------------------------------------
  // 7. Form Submission & Confetti Animation
  // ----------------------------------------------------
  // Helper to compress images client-side to prevent localStorage quota issues
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Use high resolution (Full HD 1920px) to keep images very sharp and clear
          const MAX_WIDTH = 1920; 
          const MAX_HEIGHT = 1920;
          let width = img.width;
          let height = img.height;

          // Only scale down if the image exceeds the maximum dimensions
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width > height) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            } else {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Enable high-quality image smoothing to prevent blurriness during resize
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 85% quality to keep it crystal clear and well under 2MB (typically 300KB - 800KB)
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  function resetSubmitBtn() {
    btnNext.classList.remove('loading');
    btnNext.disabled = false;
    btnBack.disabled = false;
  }

  function finishSubmission(outletVal, programVal, startVal, endVal, typesVal) {
    resetSubmitBtn();
    
    const totalCount = uploadedImagesDisplay1.length + uploadedImagesDisplay2.length + uploadedImagesDisplay3.length;
    
    document.getElementById('sumOutletName').textContent = outletVal;
    document.getElementById('sumProgramName').textContent = programVal;
    document.getElementById('sumEventTime').textContent = startVal && endVal ? `${formatDate(startVal)} - ${formatDate(endVal)}` : 'Trưng bày thực tế';
    document.getElementById('sumEventType').textContent = truncateText(typesVal, 50);
    document.getElementById('sumImages').textContent = `${totalCount} ảnh đã xác thực`;
    
    successOverlay.classList.add('active');
    triggerConfetti();
    showToast('Gửi báo cáo thành công', 'Báo cáo sự kiện đã được ghi lại.', 'success');
  }

  function submitForm() {
    // Show Loading state on button
    btnNext.classList.add('loading');
    btnNext.disabled = true;
    btnBack.disabled = true;

    // Show processing toast
    showToast('Đang xử lý', 'Đang nén hình ảnh và mã hóa dữ liệu...', 'info', 2000);
    
    const filesToCompress = [
      ...uploadedImagesDisplay1,
      ...uploadedImagesDisplay2,
      ...uploadedImagesDisplay3
    ];
    
    // Compress images asynchronously
    const compressPromises = filesToCompress.map(file => compressImage(file));
    
    Promise.all(compressPromises)
      .then(base64Images => {
        // Create report object
        const isDisplay = document.querySelector('input[name="activityType"]:checked').value === 'Display';
        const outletVal = document.getElementById('outletName').value.trim();
        const programVal = isDisplay ? 'Trưng bày (Display)' : document.getElementById('programName').value.trim();
        const startVal = isDisplay ? '' : document.getElementById('startDate').value;
        const endVal = isDisplay ? '' : document.getElementById('endDate').value;
        
        let typesList = [];
        let typesVal = '';
        let contentVal = '';
        
        if (!isDisplay) {
          const checkedBoxes = Array.from(document.querySelectorAll('input[name="eventType"]:checked'));
          typesList = checkedBoxes.map(cb => cb.value);
          typesVal = typesList.join(', ');
          contentVal = document.getElementById('eventContent').value;
        } else {
          typesList = ['Trưng bày (Display)'];
          typesVal = 'Trưng bày (Display)';
          contentVal = 'Hình ảnh trưng bày thực tế tại outlet';
        }
        
        const guaranteeVal = document.querySelector('input[name="guarantee"]:checked').value;
        const reportId = 'REP_' + Date.now();
        let uploadPromise;

        if (useFirebase) {
          showToast('Đang tải ảnh', 'Đang gửi hình ảnh lên Cloud Storage...', 'info', 2000);
          const uploadPromises = base64Images.map((b64, idx) => {
            const path = `reports/${reportId}/image_${idx}.jpg`;
            return storage.ref().child(path).putString(b64, 'data_url')
              .then(snapshot => snapshot.ref.getDownloadURL());
          });
          uploadPromise = Promise.all(uploadPromises);
        } else {
          uploadPromise = Promise.resolve(base64Images);
        }

        uploadPromise.then(finalImages => {
          const newReport = {
            id: reportId,
            activityType: isDisplay ? 'Display' : 'Event',
            outletName: outletVal,
            programName: programVal,
            startDate: startVal,
            endDate: endVal,
            eventTypes: typesList,
            eventContent: contentVal,
            guarantee: guaranteeVal,
            images: finalImages, // array of base64s OR storage URLs
            timestamp: new Date().toISOString()
          };

          if (useFirebase) {
            db.collection('reports').doc(reportId).set(newReport).then(() => {
              finishSubmission(outletVal, programVal, startVal, endVal, typesVal);
            }).catch(err => {
              console.error("Firestore save error:", err);
              resetSubmitBtn();
              showToast('Lỗi gửi báo cáo', 'Không thể lưu thông tin vào cơ sở dữ liệu đám mây.', 'error');
            });
          } else {
            reports.push(newReport);
            localStorage.setItem('diageo_reports', JSON.stringify(reports));
            renderReportsTable();
            finishSubmission(outletVal, programVal, startVal, endVal, typesVal);
          }
        }).catch(err => {
          console.error("Upload error:", err);
          resetSubmitBtn();
          showToast('Lỗi tải ảnh', 'Không thể tải hình ảnh lên Cloud Storage.', 'error');
        });
      })
      .catch(err => {
        console.error("Compression error:", err);
        resetSubmitBtn();
        showToast('Lỗi xử lý ảnh', 'Không thể xử lý hình ảnh tải lên.', 'error');
      });
  }
  
  // Format YYYY-MM-DD to DD/MM/YYYY
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function truncateText(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  function triggerConfetti() {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';
    
    const colors = ['#6366f1', '#a855f7', '#fbbf24', '#10b981', '#ef4444', '#38bdf8'];
    const count = 60;
    
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      
      // Randomize parameters
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100; // percent
      const sizeWidth = Math.random() * 8 + 6; // px
      const sizeHeight = Math.random() * 12 + 8; // px
      const rotation = Math.random() * 360; // deg
      const delay = Math.random() * 2; // seconds
      const duration = Math.random() * 2.5 + 2.5; // seconds
      
      piece.style.background = color;
      piece.style.left = `${left}%`;
      piece.style.width = `${sizeWidth}px`;
      piece.style.height = `${sizeHeight}px`;
      piece.style.transform = `rotate(${rotation}deg)`;
      piece.style.animationDelay = `${delay}s`;
      piece.style.animationDuration = `${duration}s`;
      
      container.appendChild(piece);
    }
  }

  // ----------------------------------------------------
  // 8. Form Reset Actions
  // ----------------------------------------------------
  btnReset.addEventListener('click', () => {
    // Reset inputs
    form.reset();
    
    // Clear checkboxes and radio style checked states
    document.querySelectorAll('.selector-card').forEach(card => {
      card.classList.remove('checked');
    });
    
    // Reset activityType radio UI state back to default (Event)
    const defaultEventRadio = document.getElementById('actEvent');
    if (defaultEventRadio) {
      defaultEventRadio.checked = true;
      defaultEventRadio.closest('.selector-card').classList.add('checked');
      handleActivityTypeChange('Event');
    }
    // Reset file manager state
    if (eventGalleryControl) eventGalleryControl.clear();
    if (displayGallery1Control) displayGallery1Control.clear();
    if (displayGallery2Control) displayGallery2Control.clear();
    if (displayGallery3Control) displayGallery3Control.clear();
    
    // Clear validation error borders
    document.querySelectorAll('.form-group').forEach(group => {
      group.classList.remove('has-error');
      const err = group.querySelector('.error-message');
      if (err) {
        err.style.display = 'none';
        err.textContent = '';
      }
    });
    galleryError.style.display = 'none';
    galleryError.textContent = '';
    
    // Reset views
    successOverlay.classList.remove('active');
    currentStep = 1;
    updateStepUI();
    
    showToast('Khởi tạo lại form', 'Form đã được dọn sạch để điền báo cáo mới.', 'info');
  });

  // ----------------------------------------------------
  // 9. Admin Portal Logic
  // ----------------------------------------------------
  const btnAdminTrigger = document.getElementById('btnAdminTrigger');
  const adminLoginModal = document.getElementById('adminLoginModal');
  const btnCloseLogin = document.getElementById('btnCloseLogin');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  const adminPasswordInput = document.getElementById('adminPassword');
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const adminLoginError = document.getElementById('admin-login-error');
  
  const adminDashboard = document.getElementById('adminDashboard');
  const salesFormContainer = document.getElementById('salesFormContainer');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  
  const adminTabs = document.querySelectorAll('.admin-tab');
  const adminTabContents = document.querySelectorAll('.admin-tab-content');
  
  const reportTableBody = document.getElementById('reportTableBody');
  const programCrudList = document.getElementById('programCrudList');
  const newProgramNameInput = document.getElementById('newProgramName');
  const btnAddProgram = document.getElementById('btnAddProgram');
  
  const editProgramModal = document.getElementById('editProgramModal');
  const editProgramNameInput = document.getElementById('editProgramNameInput');
  const editProgramIndex = document.getElementById('editProgramIndex');
  const btnCancelEditProgram = document.getElementById('btnCancelEditProgram');
  const btnSaveEditProgram = document.getElementById('btnSaveEditProgram');
  
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxImg = document.getElementById('lightboxImg');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');

  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnExportPPT = document.getElementById('btnExportPPT');
  const btnClearAllReports = document.getElementById('btnClearAllReports');

  // Open login modal
  btnAdminTrigger.addEventListener('click', () => {
    adminLoginModal.classList.add('active');
    adminPasswordInput.value = '';
    adminPasswordInput.type = 'password';
    btnTogglePassword.querySelector('i').className = 'fa-regular fa-eye';
    btnTogglePassword.title = 'Hiện mật khẩu';
    adminPasswordInput.focus();
    clearAdminLoginError();
  });

  // Close login modal
  btnCloseLogin.addEventListener('click', () => {
    adminLoginModal.classList.remove('active');
  });

  // Submit Password
  btnSubmitLogin.addEventListener('click', handleAdminLogin);
  adminPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });

  // Toggle password visibility
  btnTogglePassword.addEventListener('click', () => {
    const isPassword = adminPasswordInput.type === 'password';
    adminPasswordInput.type = isPassword ? 'text' : 'password';
    const icon = btnTogglePassword.querySelector('i');
    if (isPassword) {
      icon.className = 'fa-regular fa-eye-slash';
      btnTogglePassword.title = 'Ẩn mật khẩu';
    } else {
      icon.className = 'fa-regular fa-eye';
      btnTogglePassword.title = 'Hiện mật khẩu';
    }
  });

  function handleAdminLogin() {
    const pw = adminPasswordInput.value;
    if (pw === 'diageo@123') {
      adminLoginModal.classList.remove('active');
      salesFormContainer.style.display = 'none';
      adminDashboard.classList.add('active');
      btnAdminTrigger.style.display = 'none';
      document.querySelector('.app-container').classList.add('admin-mode');
      
      // Load and render data
      renderReportsTable();
      renderProgramCrudList();
      
      showToast('Đăng nhập thành công', 'Chào mừng bạn đến với Cổng Quản trị.', 'success');
    } else {
      showAdminLoginError('Mật khẩu không chính xác.');
      // Shake animation
      const card = adminLoginModal.querySelector('.admin-login-card');
      card.style.animation = 'none';
      setTimeout(() => {
        card.style.animation = 'shake 0.3s ease';
      }, 10);
    }
  }

  function showAdminLoginError(msg) {
    document.getElementById('group-admin-password').classList.add('has-error');
    adminLoginError.textContent = msg;
    adminLoginError.style.display = 'flex';
  }

  function clearAdminLoginError() {
    document.getElementById('group-admin-password').classList.remove('has-error');
    adminLoginError.textContent = '';
    adminLoginError.style.display = 'none';
  }

  // Logout
  btnAdminLogout.addEventListener('click', () => {
    adminDashboard.classList.remove('active');
    salesFormContainer.style.display = 'block';
    btnAdminTrigger.style.display = 'inline-flex';
    document.querySelector('.app-container').classList.remove('admin-mode');
    showToast('Đã đăng xuất', 'Bạn đã rời khỏi phiên quản trị viên.', 'info');
  });

  // Tab switching
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      adminTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetTab = tab.dataset.tab;
      adminTabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  });

  // ----------------------------------------------------
  // 10. Reports Management & Rendering
  // ----------------------------------------------------
  function renderReportsTable() {
    reportTableBody.innerHTML = '';
    
    if (reports.length === 0) {
      reportTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="no-data-msg">Chưa có báo cáo nào được gửi lên hệ thống.</div>
          </td>
        </tr>
      `;
      return;
    }

    // Sort reports by newest first
    const sortedReports = [...reports].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedReports.forEach(report => {
      const tr = document.createElement('tr');
      
      // Outlet cell
      const tdOutlet = document.createElement('td');
      tdOutlet.innerHTML = `<div class="event-name-td">${report.outletName || report.eventName || '-'}</div>`;

      // Program cell
      const tdProgram = document.createElement('td');
      tdProgram.innerHTML = `<div class="event-name-td" style="font-weight: 500;">${report.programName || '-'}</div>`;
      
      // Dates cell
      const tdTime = document.createElement('td');
      if (report.activityType === 'Display' || (!report.startDate && !report.endDate)) {
        tdTime.innerHTML = `<div class="date-td text-muted" style="font-style: italic;">Không áp dụng<br>(Trưng bày)</div>`;
      } else {
        tdTime.innerHTML = `
          <div class="date-td">
            <strong>Bắt đầu:</strong> ${formatDate(report.startDate)}<br>
            <strong>Kết thúc:</strong> ${formatDate(report.endDate)}
          </div>
        `;
      }
      
      // Categories cell
      const tdTypes = document.createElement('td');
      const typesHtml = report.eventTypes.map(t => `<span>${t}</span>`).join('');
      tdTypes.innerHTML = `<div class="types-td">${typesHtml}</div>`;
      
      // Summary Content cell
      const tdContent = document.createElement('td');
      tdContent.textContent = report.eventContent || '(Không có tóm tắt)';
      
      // Thumbnails cell
      const tdGallery = document.createElement('td');
      const thumbList = document.createElement('div');
      thumbList.className = 'thumbnail-list';
      
      if (report.images && report.images.length > 0) {
        report.images.forEach(imgBase64 => {
          const img = document.createElement('img');
          img.className = 'table-thumbnail';
          img.src = imgBase64;
          img.alt = 'Proof';
          
          img.addEventListener('click', () => {
            lightboxImg.src = imgBase64;
            lightboxOverlay.classList.add('active');
          });
          
          thumbList.appendChild(img);
        });
      } else {
        thumbList.textContent = '(Không có ảnh)';
      }
      tdGallery.appendChild(thumbList);
      
      // Guarantee cell
      const tdGuarantee = document.createElement('td');
      tdGuarantee.textContent = report.guarantee;
      
      tr.appendChild(tdOutlet);
      tr.appendChild(tdProgram);
      tr.appendChild(tdTime);
      tr.appendChild(tdTypes);
      tr.appendChild(tdContent);
      tr.appendChild(tdGallery);
      tr.appendChild(tdGuarantee);
      
      reportTableBody.appendChild(tr);
    });
  }

  // Lightbox close listeners
  btnCloseLightbox.addEventListener('click', () => {
    lightboxOverlay.classList.remove('active');
  });
  
  lightboxOverlay.addEventListener('click', (e) => {
    if (e.target === lightboxOverlay) {
      lightboxOverlay.classList.remove('active');
    }
  });

  // ----------------------------------------------------
  // 11. Program CRUD Logic
  // ----------------------------------------------------
  function renderProgramCrudList() {
    programCrudList.innerHTML = '';
    
    samplePrograms.forEach((prog, index) => {
      const item = document.createElement('div');
      item.className = 'program-crud-item';
      
      item.innerHTML = `
        <span class="program-crud-name" title="${prog}">${prog}</span>
        <div class="program-crud-actions">
          <button type="button" class="btn-crud-action btn-crud-edit" data-index="${index}" title="Sửa tên">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button type="button" class="btn-crud-action btn-crud-delete" data-index="${index}" title="Xóa">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      
      // Add edit action listener
      item.querySelector('.btn-crud-edit').addEventListener('click', () => {
        editProgramNameInput.value = prog;
        editProgramIndex.value = index;
        editProgramModal.classList.add('active');
        editProgramNameInput.focus();
      });
      
      // Add delete action listener
      item.querySelector('.btn-crud-delete').addEventListener('click', () => {
        if (confirm(`Bạn chắc chắn muốn xóa Outlet: "${prog}"?`)) {
          if (useFirebase) {
            db.collection('programs').where('name', '==', prog).get().then(snapshot => {
              snapshot.forEach(doc => doc.ref.delete());
              showToast('Đã xóa', 'Xóa tên Outlet thành công.', 'success');
            }).catch(err => {
              console.error("Firestore delete error:", err);
              showToast('Lỗi', 'Không thể xóa Outlet trên đám mây.', 'error');
            });
          } else {
            samplePrograms.splice(index, 1);
            localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
            renderProgramCrudList();
            showToast('Đã xóa', 'Xóa tên Outlet thành công.', 'success');
          }
        }
      });
      
      programCrudList.appendChild(item);
    });
  }

  // Create program
  btnAddProgram.addEventListener('click', () => {
    const newName = newProgramNameInput.value.trim();
    if (!newName) {
      showToast('Thông tin trống', 'Vui lòng nhập tên Outlet.', 'warning');
      return;
    }
    
    if (samplePrograms.includes(newName)) {
      showToast('Trùng lặp', 'Tên Outlet này đã tồn tại.', 'warning');
      return;
    }
    
    if (useFirebase) {
      db.collection('programs').add({ name: newName }).then(() => {
        newProgramNameInput.value = '';
        showToast('Đã thêm', 'Thêm Outlet mới thành công.', 'success');
      }).catch(err => {
        console.error("Firestore add error:", err);
        showToast('Lỗi', 'Không thể thêm Outlet vào đám mây.', 'error');
      });
    } else {
      samplePrograms.push(newName);
      localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
      newProgramNameInput.value = '';
      renderProgramCrudList();
      showToast('Đã thêm', 'Thêm Outlet mới thành công.', 'success');
    }
  });

  // Edit Program modal actions
  btnCancelEditProgram.addEventListener('click', () => {
    editProgramModal.classList.remove('active');
  });
  
  btnSaveEditProgram.addEventListener('click', () => {
    const updatedName = editProgramNameInput.value.trim();
    const index = parseInt(editProgramIndex.value);
    const oldName = samplePrograms[index];
    
    if (!updatedName) {
      showToast('Thông tin trống', 'Tên Outlet không được để trống.', 'warning');
      return;
    }
    
    // Check duplication with other items
    const duplicate = samplePrograms.some((prog, idx) => prog === updatedName && idx !== index);
    if (duplicate) {
      showToast('Trùng lặp', 'Tên Outlet này đã tồn tại.', 'warning');
      return;
    }
    
    if (useFirebase) {
      db.collection('programs').where('name', '==', oldName).get().then(snapshot => {
        snapshot.forEach(doc => doc.ref.update({ name: updatedName }));
        editProgramModal.classList.remove('active');
        showToast('Đã cập nhật', 'Cập nhật tên Outlet thành công.', 'success');
      }).catch(err => {
        console.error("Firestore update error:", err);
        showToast('Lỗi', 'Không thể cập nhật Outlet trên đám mây.', 'error');
      });
    } else {
      samplePrograms[index] = updatedName;
      localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
      editProgramModal.classList.remove('active');
      renderProgramCrudList();
      showToast('Đã cập nhật', 'Cập nhật tên Outlet thành công.', 'success');
    }
  });


  // Clear All Reports Button
  btnClearAllReports.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn xóa TẤT CẢ báo cáo hiện tại không? Hành động này không thể hoàn tác.')) {
      if (useFirebase) {
        showToast('Đang xóa', 'Đang xóa tất cả báo cáo trên đám mây...', 'info', 2000);
        db.collection('reports').get().then(snapshot => {
          const deletePromises = [];
          snapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
            const reportData = doc.data();
            const imgCount = reportData.images ? reportData.images.length : 0;
            for (let i = 0; i < imgCount; i++) {
              try {
                storage.ref().child(`reports/${doc.id}/image_${i}.jpg`).delete();
              } catch (e) {
                console.error("Error deleting storage image:", e);
              }
            }
          });
          return Promise.all(deletePromises);
        }).then(() => {
          showToast('Đã xóa dữ liệu', 'Đã xóa tất cả báo cáo trên Firebase thành công.', 'success');
        }).catch(err => {
          console.error("Firebase delete error:", err);
          showToast('Lỗi', 'Không thể xóa dữ liệu trên đám mây.', 'error');
        });
      } else {
        reports = [];
        localStorage.setItem('diageo_reports', JSON.stringify([]));
        renderReportsTable();
        showToast('Đã xóa dữ liệu', 'Đã xóa tất cả báo cáo thành công.', 'success');
      }
    }
  });

  // Helper to pre-load and convert data or HTTP URLs into clean base64 string for exporting
  function cleanImageForExport(imgSrc) {
    if (!imgSrc) return Promise.resolve({ success: false });

    // Case 1: Already a Base64 data URL
    if (imgSrc.startsWith('data:')) {
      const commaIdx = imgSrc.indexOf(',');
      const base64 = commaIdx !== -1 ? imgSrc.substring(commaIdx + 1) : imgSrc;
      return Promise.resolve({ success: true, base64, originalSrc: imgSrc });
    }

    // Case 2: Remote HTTP/HTTPS URL
    if (imgSrc.startsWith('http')) {
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(imgSrc)}`,
        `https://corsproxy.io/?${encodeURIComponent(imgSrc)}`,
        imgSrc // direct fetch as final fallback
      ];

      const fetchWithFallback = (proxyIndex) => {
        if (proxyIndex >= proxies.length) {
          return Promise.resolve({ success: false, originalSrc: imgSrc });
        }

        const urlToFetch = proxies[proxyIndex];
        return fetch(urlToFetch)
          .then(res => {
            if (!res.ok) throw new Error("Status " + res.status);
            return res.blob();
          })
          .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result;
              const commaIdx = dataUrl.indexOf(',');
              const base64 = commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl;
              resolve({ success: true, base64, originalSrc: imgSrc });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }))
          .catch(err => {
            console.warn(`Proxy ${urlToFetch} failed:`, err);
            return fetchWithFallback(proxyIndex + 1);
          });
      };

      return fetchWithFallback(0);
    }

    return Promise.resolve({ success: false, originalSrc: imgSrc });
  }

  // Excel XLSX Export with Images using ExcelJS
  btnExportExcel.addEventListener('click', () => {
    if (reports.length === 0) {
      showToast('Không có dữ liệu', 'Không có báo cáo nào để xuất.', 'warning');
      return;
    }

    showToast('Đang tạo XLSX', 'Đang thiết lập bảng tính và nhúng hình ảnh...', 'info', 3000);

    // Pre-clean all images for all reports before building workbook
    const reportCleanPromises = reports.map(report => {
      const imagePromises = (report.images || []).map(imgSrc => cleanImageForExport(imgSrc));
      return Promise.all(imagePromises).then(cleanedImages => {
        return { ...report, cleanedImages };
      });
    });

    Promise.all(reportCleanPromises)
      .then(cleanedReports => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo Activation');
        worksheet.views = [{ showGridLines: true }];

        // Calculate maximum images
        let maxImages = 4;
        cleanedReports.forEach(r => {
          if (r.cleanedImages && r.cleanedImages.length > maxImages) {
            maxImages = r.cleanedImages.length;
          }
        });

        // Set column definitions dynamically
        const columns = [
          { header: 'Mã báo cáo', key: 'id', width: 18 },
          { header: 'Tên Outlet', key: 'outletName', width: 35 },
          { header: 'Loại hoạt động', key: 'activityType', width: 18 },
          { header: 'Tên chương trình', key: 'programName', width: 35 },
          { header: 'Ngày bắt đầu', key: 'startDate', width: 15 },
          { header: 'Ngày kết thúc', key: 'endDate', width: 15 },
          { header: 'Loại hình', key: 'eventTypes', width: 35 },
          { header: 'Nội dung tóm tắt', key: 'eventContent', width: 50 },
          { header: 'Xác thực cam đoan', key: 'guarantee', width: 20 },
          { header: 'Thời gian gửi', key: 'timestamp', width: 22 }
        ];

        for (let i = 1; i <= maxImages; i++) {
          columns.push({ header: `Ảnh minh chứng ${i}`, key: `img${i}`, width: 24 });
        }
        worksheet.columns = columns;

        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFF' }, name: 'Segoe UI', size: 11 };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F46E5' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'CBD5E1' } },
            left: { style: 'thin', color: { argb: 'CBD5E1' } },
            bottom: { style: 'medium', color: { argb: '475569' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
          };
        });

        // Populate data
        cleanedReports.forEach((report) => {
          const row = worksheet.addRow({
            id: report.id,
            outletName: report.outletName || report.eventName || '-',
            activityType: report.activityType === 'Display' ? 'Display' : 'Event',
            programName: report.programName || '-',
            startDate: report.activityType === 'Display' ? '-' : (formatDate(report.startDate) || '-'),
            endDate: report.activityType === 'Display' ? '-' : (formatDate(report.endDate) || '-'),
            eventTypes: report.eventTypes ? report.eventTypes.join(', ') : '-',
            eventContent: report.eventContent || '-',
            guarantee: report.guarantee,
            timestamp: new Date(report.timestamp).toLocaleString('vi-VN')
          });

          row.height = 100;

          // Style cells
          for (let colNum = 1; colNum <= columns.length; colNum++) {
            const cell = row.getCell(colNum);
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
            const isCenter = colNum === 1 || colNum === 3 || colNum === 5 || colNum === 6 || colNum === 9 || colNum === 10 || colNum >= 11;
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: isCenter ? 'center' : 'left', 
              wrapText: true 
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'F1F5F9' } },
              left: { style: 'thin', color: { argb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
              right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
          }

          // Add images to cells
          report.cleanedImages.forEach((imgResult, imgIdx) => {
            if (imgResult.success) {
              try {
                const imageId = workbook.addImage({
                  base64: imgResult.base64,
                  extension: 'jpeg'
                });
                worksheet.addImage(imageId, {
                  tl: { col: 10 + imgIdx, row: row.number - 1 },
                  ext: { width: 120, height: 90 },
                  editAs: 'oneCell'
                });
              } catch (e) {
                console.error("Error adding image to cell:", e);
              }
            } else {
              worksheet.getCell(row.number, 11 + imgIdx).value = {
                text: `Xem ảnh ${imgIdx + 1}`,
                hyperlink: imgResult.originalSrc
              };
            }
          });
        });

        return workbook.xlsx.writeBuffer();
      })
      .then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Diageo_Reports_Export_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Xuất Excel thành công', 'File Excel (.xlsx) chứa hình ảnh đã tải xuống.', 'success');
      })
      .catch(err => {
        console.error("ExcelJS export error:", err);
        showToast('Lỗi xuất Excel', 'Không thể tạo file Excel chứa ảnh.', 'error');
      });
  });

  // PowerPoint Slide Export
  btnExportPPT.addEventListener('click', () => {
    if (reports.length === 0) {
      showToast('Không có dữ liệu', 'Không có báo cáo nào để xuất.', 'warning');
      return;
    }
    
    showToast('Đang tạo PPTX', 'Đang thiết lập bố cục slide PowerPoint...', 'info', 2000);

    // Pre-clean all images for all reports before building PPTX presentation
    const reportCleanPromises = reports.map(report => {
      const imagePromises = (report.images || []).map(imgSrc => cleanImageForExport(imgSrc));
      return Promise.all(imagePromises).then(cleanedImages => {
        return { ...report, cleanedImages };
      });
    });

    Promise.all(reportCleanPromises)
      .then(cleanedReports => {
        let pptx = new PptxGenJS();
        pptx.title = "Diageo On-Trade Activation Report";
        pptx.layout = "LAYOUT_16x9";
        
        cleanedReports.forEach((report, index) => {
          const images = report.cleanedImages || [];
          const imagesPerSlide = 6;
          const totalSlidesForReport = Math.max(1, Math.ceil(images.length / imagesPerSlide));
          
          for (let slideIdx = 0; slideIdx < totalSlidesForReport; slideIdx++) {
            let slide = pptx.addSlide();
            
            // 1. Header Bar (Dark Navy)
            slide.addShape(pptx.ShapeType.rect, {
              x: 0, y: 0, w: "100%", h: 0.9,
              fill: { color: "4f46e5" }
            });
            
            slide.addText(`DIAGEO ON-TRADE CONTRACTED PROGRAM`, {
              x: 0.5, y: 0.15, fontSize: 11, bold: true, color: "fbbf24"
            });
            
            const pageSuffix = totalSlidesForReport > 1 ? ` (Trang ${slideIdx + 1}/${totalSlidesForReport})` : "";
            slide.addText(`BÁO CÁO ACTIVATION #${index + 1}${pageSuffix}`, {
              x: 0.5, y: 0.42, fontSize: 18, bold: true, color: "ffffff"
            });

            // 2. Left side: Report Metadata Card
            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.5, y: 1.2, w: 4.0, h: 4.8,
              fill: { color: "f8fafc" },
              line: { color: "cbd5e1", width: 1 },
              radius: 0.05
            });
            
            let textRuns = [];
            if (report.activityType === 'Display') {
              textRuns = [
                { text: "TÊN OUTLET:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: (report.outletName || report.eventName || '-') + "\n\n", options: { color: "334155", fontSize: 9.5, bold: true } },
                { text: "LOẠI HOẠT ĐỘNG:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: "Trưng bày (Display)\n\n", options: { color: "6366f1", bold: true, fontSize: 9.5 } },
                { text: "TRẠNG THÁI XÁC THỰC:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${report.guarantee} tại thời điểm viếng thăm`, options: { color: "64748b", italic: true, fontSize: 8.5 } }
              ];
            } else {
              textRuns = [
                { text: "TÊN OUTLET:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: (report.outletName || report.eventName || '-') + "\n", options: { color: "334155", fontSize: 9.0, bold: true } },
                { text: "TÊN CHƯƠNG TRÌNH:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: (report.programName || '-') + "\n", options: { color: "334155", fontSize: 9.0, bold: true } },
                { text: "THỜI GIAN DIỄN RA:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${formatDate(report.startDate)} - ${formatDate(report.endDate)}\n`, options: { color: "475569", fontSize: 8.5 } },
                { text: "LOẠI HÌNH HOẠT ĐỘNG:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${report.eventTypes ? report.eventTypes.join(', ') : '-'}\n`, options: { color: "6366f1", bold: true, fontSize: 8.5 } },
                { text: "NỘI DUNG TÓM TẮT:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${report.eventContent || '(Không có tóm tắt)'}\n`, options: { color: "475569", fontSize: 8.5 } },
                { text: "TRẠNG THÁI XÁC THỰC:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${report.guarantee} tại thời điểm viếng thăm`, options: { color: "64748b", italic: true, fontSize: 8.0 } }
              ];
            }

            slide.addText(textRuns, {
              x: 0.7, y: 1.35, w: 3.6, h: 4.5,
              valign: "top"
            });

            // 3. Right side: Dynamic Image Gallery Grid
            const galleryTitle = report.activityType === 'Display' ? 'HÌNH ẢNH MINH CHỨNG TRƯNG BÀY' : 'HÌNH ẢNH MINH CHỨNG SỰ KIỆN';
            slide.addText(`${galleryTitle}${pageSuffix.toUpperCase()}`, {
              x: 4.8, y: 1.2, w: 8.0, fontSize: 10, bold: true, color: "4f46e5"
            });

            const startImgIdx = slideIdx * imagesPerSlide;
            const slideImages = images.slice(startImgIdx, startImgIdx + imagesPerSlide);
            const imgCount = slideImages.length;

            const drawImageWithFallback = (imgResult, options) => {
              if (imgResult && imgResult.success) {
                slide.addImage({ data: imgResult.base64, ...options });
              } else {
                slide.addText("[Ảnh lỗi hoặc không thể tải]", {
                  ...options,
                  fontSize: 9,
                  color: "ef4444",
                  align: "center",
                  valign: "middle",
                  fill: { color: "fee2e2" },
                  line: { color: "fca5a5", width: 1 }
                });
              }
            };

            if (imgCount > 0) {
              if (imgCount === 1) {
                drawImageWithFallback(slideImages[0], { x: 5.8, y: 1.6, w: 5.4, h: 3.6 });
              } 
              else if (imgCount === 2) {
                const imgWidth = 3.6;
                const imgHeight = 2.4;
                drawImageWithFallback(slideImages[0], { x: 5.0, y: 2.2, w: imgWidth, h: imgHeight });
                drawImageWithFallback(slideImages[1], { x: 8.8, y: 2.2, w: imgWidth, h: imgHeight });
              } 
              else if (imgCount === 3 || imgCount === 4) {
                const imgWidth = 3.6;
                const imgHeight = 2.3;
                drawImageWithFallback(slideImages[0], { x: 4.9, y: 1.5, w: imgWidth, h: imgHeight });
                drawImageWithFallback(slideImages[1], { x: 8.7, y: 1.5, w: imgWidth, h: imgHeight });
                drawImageWithFallback(slideImages[2], { x: 4.9, y: 3.9, w: imgWidth, h: imgHeight });
                if (slideImages[3]) drawImageWithFallback(slideImages[3], { x: 8.7, y: 3.9, w: imgWidth, h: imgHeight });
              } 
              else {
                const imgWidth = 2.4;
                const imgHeight = 2.3;
                drawImageWithFallback(slideImages[0], { x: 4.8, y: 1.5, w: imgWidth, h: imgHeight });
                drawImageWithFallback(slideImages[1], { x: 7.4, y: 1.5, w: imgWidth, h: imgHeight });
                drawImageWithFallback(slideImages[2], { x: 10.0, y: 1.5, w: imgWidth, h: imgHeight });
                drawImageWithFallback(slideImages[3], { x: 4.8, y: 3.9, w: imgWidth, h: imgHeight });
                if (slideImages[4]) drawImageWithFallback(slideImages[4], { x: 7.4, y: 3.9, w: imgWidth, h: imgHeight });
                if (slideImages[5]) drawImageWithFallback(slideImages[5], { x: 10.0, y: 3.9, w: imgWidth, h: imgHeight });
              }
            } else {
              slide.addText("Không có hình ảnh đính kèm.", {
                x: 4.8, y: 2.5, w: 8.0, fontSize: 12, italic: true, color: "94a3b8"
              });
            }
          }
        });

        return pptx.writeFile({ fileName: `Diageo_Activation_Report_Export_${Date.now()}.pptx` });
      })
      .then(() => {
        showToast('Xuất PowerPoint thành công', 'File báo cáo .pptx đã được tải xuống.', 'success');
      })
      .catch(err => {
        console.error("PPTX export error:", err);
        showToast('Lỗi xuất PPTX', 'Không thể tạo file slide báo cáo.', 'error');
      });
  });

  // Run initial state update
  updateStepUI();

  // Initialize data stores (after all DOM elements and helper functions are declared)
  initPrograms();
  initReports();
});
