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
  let allProducts = [];

  function initPrograms() {
    if (useFirebase) {
      db.collection('programs').orderBy('name').onSnapshot((snapshot) => {
        samplePrograms = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          samplePrograms.push({
            id: doc.id,
            name: data.name,
            psNames: data.psNames || []
          });
        });
        renderProgramCrudList();
        if (typeof renderAutocomplete === 'function') renderAutocomplete();
      });
    } else {
      const stored = localStorage.getItem('diageo_programs');
      if (stored) {
        try {
          let parsed = JSON.parse(stored);
          samplePrograms = parsed.map(item => {
            if (typeof item === 'string') {
              return { name: item, psNames: [] };
            }
            return { id: item.id || '', name: item.name, psNames: item.psNames || [] };
          });
        } catch (e) {
          console.error("Error parsing programs:", e);
          samplePrograms = [];
        }
      } else {
        samplePrograms = [];
        localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
      }
    }
  }

  function initProducts() {
    if (useFirebase) {
      db.collection('products').onSnapshot((snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.brand && data.sku) {
            allProducts.push({
              id: doc.id,
              brand: data.brand,
              sku: data.sku
            });
          }
        });
        
        // Sort client-side to avoid composite index requirement
        allProducts.sort((a, b) => {
          const brandCompare = (a.brand || '').localeCompare(b.brand || '', 'vi');
          if (brandCompare !== 0) return brandCompare;
          return (a.sku || '').localeCompare(b.sku || '', 'vi');
        });
        
        if (allProducts.length === 0) {
          seedProducts();
        } else {
          if (typeof renderProductsCrudList === 'function') renderProductsCrudList();
          if (typeof renderPsProductGrid === 'function') renderPsProductGrid();
        }
      }, (error) => {
        console.error("Firestore products sync error:", error);
      });
    } else {
      const stored = localStorage.getItem('diageo_products');
      if (stored) {
        const temp = JSON.parse(stored);
        allProducts = temp.filter(p => p && p.brand && p.sku);
        if (allProducts.length === 0) {
          seedProducts();
        } else {
          if (typeof renderProductsCrudList === 'function') renderProductsCrudList();
          if (typeof renderPsProductGrid === 'function') renderPsProductGrid();
        }
      } else {
        seedProducts();
      }
    }
  }

  function seedProducts() {
    fetch('products.json')
      .then(r => r.json())
      .then(data => {
        if (useFirebase) {
          const batch = db.batch();
          data.forEach(prod => {
            const docRef = db.collection('products').doc();
            batch.set(docRef, prod);
          });
          batch.commit().then(() => {
            console.log("Diageo products seeded successfully in Firestore.");
          }).catch(err => console.error("Error seeding products to Firestore:", err));
        } else {
          allProducts = data;
          localStorage.setItem('diageo_products', JSON.stringify(allProducts));
          if (typeof renderProductsCrudList === 'function') renderProductsCrudList();
          if (typeof renderPsProductGrid === 'function') renderPsProductGrid();
          console.log("Diageo products seeded successfully in LocalStorage.");
        }
      })
      .catch(err => {
        console.error("Error loading products.json to seed:", err);
      });
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
      prog.name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'autocomplete-no-results';
      emptyDiv.textContent = 'Không tìm thấy Outlet nào...';
      autocompleteList.appendChild(emptyDiv);
    } else {
      filtered.forEach((prog, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = prog.name;
        item.dataset.index = index;

        item.addEventListener('click', () => {
          selectProgram(prog.name);
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

    if (counterBadge) {
      counterBadge.textContent = `0/${minCount} ảnh`;
    }

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
        counterBadge.textContent = `0/${minCount} ảnh`;
        counterBadge.className = 'counter-badge';
        return;
      }

      counterText.textContent = `Đã tải lên ${filesStore.length} ảnh`;
      counterBadge.textContent = `${filesStore.length}/${minCount} ảnh`;

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
            reportDate: new Date().toISOString().split('T')[0],
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

  // Landing page selection elements
  const selectionScreen = document.getElementById('selectionScreen');
  const psComingSoonScreen = document.getElementById('psComingSoonScreen');
  const cardEventActivation = document.getElementById('cardEventActivation');
  const cardPSOnTrade = document.getElementById('cardPSOnTrade');
  const btnSelectionAdminTrigger = document.getElementById('btnSelectionAdminTrigger');
  const btnBackToSelection = document.getElementById('btnBackToSelection');
  const btnBackToLanding = document.getElementById('btnBackToLanding');
  
  const adminTabs = document.querySelectorAll('.admin-tab');
  const adminTabContents = document.querySelectorAll('.admin-tab-content');
  
  const reportTableBody = document.getElementById('reportTableBody');
  const programCrudList = document.getElementById('programCrudList');
  const newProgramNameInput = document.getElementById('newProgramName');
  const newProgramPsNamesInput = document.getElementById('newProgramPsNames');
  const btnAddProgram = document.getElementById('btnAddProgram');
  
  const editProgramModal = document.getElementById('editProgramModal');
  const editProgramNameInput = document.getElementById('editProgramNameInput');
  const editProgramPsNamesInput = document.getElementById('editProgramPsNamesInput');
  const editProgramIndex = document.getElementById('editProgramIndex');
  const btnCancelEditProgram = document.getElementById('btnCancelEditProgram');
  const btnSaveEditProgram = document.getElementById('btnSaveEditProgram');

  // Product CRUD selectors
  const newProductBrandInput = document.getElementById('newProductBrand');
  const newProductSkuInput = document.getElementById('newProductSku');
  const newProductPriceInput = document.getElementById('newProductPrice');
  const btnAddProduct = document.getElementById('btnAddProduct');
  const adminProductSearch = document.getElementById('adminProductSearch');
  const btnExportProductsExcel = document.getElementById('btnExportProductsExcel');
  const productCrudList = document.getElementById('productCrudList');

  const editProductModal = document.getElementById('editProductModal');
  const editProductBrandInput = document.getElementById('editProductBrandInput');
  const editProductSkuInput = document.getElementById('editProductSkuInput');
  const editProductPriceInput = document.getElementById('editProductPriceInput');
  const editProductIndex = document.getElementById('editProductIndex');
  const btnCancelEditProduct = document.getElementById('btnCancelEditProduct');
  const btnSaveEditProduct = document.getElementById('btnSaveEditProduct');

  // Detail View selectors
  const reportDetailModal = document.getElementById('reportDetailModal');
  const detailActivityBadge = document.getElementById('detailActivityBadge');
  const detailReportDateInput = document.getElementById('detailReportDateInput');
  const reportDetailBody = document.getElementById('reportDetailBody');
  const btnCancelReportDetail = document.getElementById('btnCancelReportDetail');
  const btnEditReportDetail = document.getElementById('btnEditReportDetail');
  const btnSaveReportDetail = document.getElementById('btnSaveReportDetail');
  const btnDeleteReportDetail = document.getElementById('btnDeleteReportDetail');
  
  let reportFilterType = 'Event'; // Filter state for reports list
  
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxImg = document.getElementById('lightboxImg');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');

  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnExportPsExcel = document.getElementById('btnExportPsExcel');
  const btnExportPPT = document.getElementById('btnExportPPT');
  const btnClearAllReports = document.getElementById('btnClearAllReports');

  // Selection Screen events
  if (cardEventActivation) {
    cardEventActivation.addEventListener('click', () => {
      window.history.pushState({}, '', '/event-activation');
      handleRouting();
    });
  }

  if (cardPSOnTrade) {
    cardPSOnTrade.addEventListener('click', () => {
      window.history.pushState({}, '', '/PS');
      handleRouting();
    });
  }

  if (btnSelectionAdminTrigger) {
    btnSelectionAdminTrigger.addEventListener('click', () => {
      window.history.pushState({}, '', '/admin');
      handleRouting();
    });
  }

  if (btnBackToSelection) {
    btnBackToSelection.addEventListener('click', () => {
      window.history.pushState({}, '', '/');
      handleRouting();
    });
  }

  if (btnBackToLanding) {
    btnBackToLanding.addEventListener('click', () => {
      window.history.pushState({}, '', '/');
      handleRouting();
    });
  }

  // Open login modal
  btnAdminTrigger.addEventListener('click', () => {
    window.history.pushState({}, '', '/admin');
    handleRouting();
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
      sessionStorage.setItem('admin_authenticated', 'true');
      adminLoginModal.classList.remove('active');
      salesFormContainer.style.display = 'none';
      adminDashboard.classList.add('active');
      btnAdminTrigger.style.display = 'none';
      document.querySelector('.app-container').classList.add('admin-mode');
      document.body.classList.add('admin-mode');
      
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
    sessionStorage.removeItem('admin_authenticated');
    window.history.pushState({}, '', '/event-activation');
    handleRouting();
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

      if (targetTab === 'products') {
        renderProductsCrudList();
      } else if (targetTab === 'programs') {
        renderProgramCrudList();
      }
    });
  });

  // Report filter bar buttons listeners
  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reportFilterType = btn.dataset.filter;
      renderReportsTable();
    });
  });

  // ----------------------------------------------------
  // 10. Reports Management & Rendering
  // ----------------------------------------------------
  function renderReportsTable() {
    if (reportTableBody) reportTableBody.innerHTML = '';
    
    // Dynamically adjust table headers based on active tab
    const reportTable = document.getElementById('reportTable');
    const reportTableHead = reportTable ? reportTable.querySelector('thead') : null;
    if (reportTableHead) {
      if (reportFilterType === 'PS') {
        reportTableHead.innerHTML = `
          <tr>
            <th>Tên Outlet</th>
            <th>Ngày</th>
            <th>Tên chương trình</th>
            <th>Thời gian</th>
            <th>Loại hình</th>
            <th>Nội dung tóm tắt</th>
            <th>Thao tác</th>
          </tr>
        `;
      } else {
        reportTableHead.innerHTML = `
          <tr>
            <th>Tên Outlet</th>
            <th>Ngày</th>
            <th>Tên chương trình</th>
            <th>Thời gian</th>
            <th>Loại hình</th>
            <th>Nội dung tóm tắt</th>
            <th>Minh chứng</th>
            <th>Cam đoan</th>
            <th>Thao tác</th>
          </tr>
        `;
      }
    }
    
    // Toggle export buttons visibility based on selected tab
    if (reportFilterType === 'Event') {
      if (btnExportExcel) btnExportExcel.style.display = 'inline-flex';
      if (btnExportPPT) btnExportPPT.style.display = 'inline-flex';
      if (btnExportPsExcel) btnExportPsExcel.style.display = 'none';
    } else {
      if (btnExportExcel) btnExportExcel.style.display = 'none';
      if (btnExportPPT) btnExportPPT.style.display = 'none';
      if (btnExportPsExcel) btnExportPsExcel.style.display = 'inline-flex';
    }
    
    let filteredReports = [...reports];
    if (reportFilterType === 'Event') {
      filteredReports = filteredReports.filter(r => r.activityType !== 'PS');
    } else if (reportFilterType === 'PS') {
      filteredReports = filteredReports.filter(r => r.activityType === 'PS');
    }

    if (filteredReports.length === 0) {
      if (reportTableBody) {
        const colSpanCount = reportFilterType === 'PS' ? 7 : 9;
        reportTableBody.innerHTML = `
          <tr>
            <td colspan="${colSpanCount}">
              <div class="no-data-msg">Không có báo cáo nào khớp với bộ lọc.</div>
            </td>
          </tr>
        `;
      }
      return;
    }

    // Sort reports by newest first
    const sortedReports = filteredReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedReports.forEach(report => {
      const tr = document.createElement('tr');
      
      // Outlet cell
      const tdOutlet = document.createElement('td');
      tdOutlet.innerHTML = `<div class="event-name-td">${report.outletName || report.eventName || '-'}</div>`;

      // Date cell
      const tdDate = document.createElement('td');
      const dateVal = report.reportDate || (report.timestamp ? report.timestamp.split('T')[0] : null);
      tdDate.innerHTML = dateVal
        ? `<div class="date-td" style="font-weight:600; color:var(--text-primary); white-space:nowrap;">${formatDate(dateVal)}</div>`
        : `<div class="date-td text-muted" style="font-style:italic;">—</div>`;

      // Program cell
      const tdProgram = document.createElement('td');
      if (report.activityType === 'PS') {
        tdProgram.innerHTML = `<div class="event-name-td" style="font-weight: 500;">KM: ${report.promoName || '-'}</div>`;
      } else {
        tdProgram.innerHTML = `<div class="event-name-td" style="font-weight: 500;">${report.programName || '-'}</div>`;
      }
      
      // Dates cell
      const tdTime = document.createElement('td');
      if (report.activityType === 'PS') {
        tdTime.innerHTML = `<div class="date-td">${formatDate(report.reportDate)}</div>`;
      } else if (report.activityType === 'Display' || (!report.startDate && !report.endDate)) {
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
      if (report.activityType === 'PS') {
        tdTypes.innerHTML = `<div class="types-td"><span style="background: rgba(168, 85, 247, 0.1); color: #a855f7; font-weight: 600; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">PS On Trade</span></div>`;
      } else {
        const typesHtml = report.eventTypes.map(t => `<span>${t}</span>`).join('');
        tdTypes.innerHTML = `<div class="types-td">${typesHtml}</div>`;
      }
      
      // Summary Content cell
      const tdContent = document.createElement('td');
      if (report.activityType === 'PS') {
        tdContent.textContent = `PS: ${report.psName}. Tỉ lệ: ${report.tableRatio}. Khách Bia: ${report.beerCustCount}. Khách ĐT: ${report.competitorCustCount}.`;
      } else {
        tdContent.textContent = report.eventContent || '(Không có tóm tắt)';
      }
      
      // Thumbnails cell
      const tdGallery = document.createElement('td');
      const thumbList = document.createElement('div');
      thumbList.className = 'thumbnail-list';
      
      if (report.activityType !== 'PS') {
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
      } else {
        thumbList.textContent = '-';
      }
      tdGallery.appendChild(thumbList);
      
      // Guarantee cell
      const tdGuarantee = document.createElement('td');
      if (report.activityType !== 'PS') {
        tdGuarantee.textContent = report.guarantee;
      } else {
        tdGuarantee.textContent = '-';
      }

      // Actions cell (Thao tác)
      const tdActions = document.createElement('td');
      const btnDetail = document.createElement('button');
      btnDetail.type = 'button';
      btnDetail.className = 'btn btn-secondary btn-detail-view';
      btnDetail.style.cssText = 'padding: 4px 8px; font-size: 0.72rem; border-radius: 4px; white-space: nowrap;';
      btnDetail.innerHTML = '<i class="fa-solid fa-eye"></i> Chi tiết';
      btnDetail.dataset.id = report.id;
      tdActions.appendChild(btnDetail);
      
      tr.appendChild(tdOutlet);
      tr.appendChild(tdDate);
      tr.appendChild(tdProgram);
      tr.appendChild(tdTime);
      tr.appendChild(tdTypes);
      tr.appendChild(tdContent);
      if (reportFilterType !== 'PS') {
        tr.appendChild(tdGallery);
        tr.appendChild(tdGuarantee);
      }
      tr.appendChild(tdActions);
      
      reportTableBody.appendChild(tr);
    });

    // Bind detail view click listeners
    reportTableBody.querySelectorAll('.btn-detail-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        showReportDetail(id);
      });
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
  // Report Detail Modal View & Edit Logic
  // ----------------------------------------------------
  let currentDetailReportId = null;

  let isDetailEditMode = false;

  function showReportDetail(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    currentDetailReportId = reportId;
    isDetailEditMode = false;
    reportDetailModal.style.display = 'flex';

    if (btnEditReportDetail) btnEditReportDetail.style.display = 'inline-flex';
    if (btnDeleteReportDetail) btnDeleteReportDetail.style.display = 'inline-flex';
    if (btnSaveReportDetail) btnSaveReportDetail.style.display = 'none';
    if (btnCancelReportDetail) btnCancelReportDetail.textContent = 'Đóng';

    if (detailReportDateInput) {
      detailReportDateInput.value = report.reportDate || (report.timestamp ? report.timestamp.split('T')[0] : '');
      detailReportDateInput.disabled = true;
    }

    if (detailActivityBadge) {
      if (report.activityType === 'PS') {
        detailActivityBadge.textContent = 'PS On Trade';
        detailActivityBadge.style.cssText = 'background: rgba(168, 85, 247, 0.1); color: #a855f7;';
      } else {
        detailActivityBadge.textContent = report.activityType || 'Event';
        detailActivityBadge.style.cssText = 'background: rgba(79, 70, 229, 0.1); color: var(--primary-color);';
      }
    }

    renderReportDetailContent(report, false);
  }

  function renderReportDetailContent(report, editMode) {
    if (!reportDetailBody) return;
    reportDetailBody.innerHTML = '';

    if (report.activityType === 'PS') {
      if (editMode) {
        // Edit Mode for PS On Trade
        let prodListHtml = '<div id="editReportProdList" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border-glass); padding: 10px; border-radius: 8px; background: white; margin-top: 5px;">';
        allProducts.forEach(prod => {
          const qty = (report.companyProductSales || {})[prod.sku] || 0;
          prodListHtml += `
            <div class="edit-prod-row" data-sku="${prod.sku.toLowerCase()}" data-brand="${prod.brand.toLowerCase()}" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-bottom: 1px solid rgba(15, 23, 42, 0.03); padding-bottom: 4px;">
              <span style="color: var(--text-secondary); max-width: 70%; text-align: left;">${prod.sku}</span>
              <input type="number" class="edit-ps-qty-input input-control" data-sku="${prod.sku}" min="0" value="${qty}" style="width: 70px; padding: 4px 8px; font-size: 0.8rem; text-align: center;">
            </div>
          `;
        });
        prodListHtml += '</div>';

        reportDetailBody.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(15, 23, 42, 0.01); padding: 15px; border-radius: 8px; border: 1px solid var(--border-glass);">
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên Outlet</label>
              <input type="text" id="editPsOutlet" class="input-control" value="${report.outletName || ''}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên PS</label>
              <input type="text" id="editPsName" class="input-control" value="${report.psName || ''}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div style="grid-column: span 2;">
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Chương trình khuyến mãi</label>
              <input type="text" id="editPsPromo" class="input-control" value="${report.promoName || ''}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tỉ lệ bàn uống rượu</label>
              <input type="text" id="editPsRatio" class="input-control" value="${report.tableRatio || ''}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Khách uống bia</label>
              <input type="number" id="editPsBeerCust" class="input-control" min="0" value="${report.beerCustCount || 0}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div style="grid-column: span 2;">
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Khách uống rượu đối thủ</label>
              <input type="number" id="editPsCompetitorCust" class="input-control" min="0" value="${report.competitorCustCount || 0}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
          </div>

          <div style="margin-top: 10px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;"><i class="fa-solid fa-bottle-water" style="color: #a855f7; margin-right: 6px;"></i> Số lượng rượu bán ra:</div>
            
            <div class="product-search-wrapper" style="margin-bottom: 8px; position: relative;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
              <input type="text" id="editReportProductSearch" class="input-control" placeholder="Tìm nhanh sản phẩm để sửa số lượng..." style="padding-left: 32px; font-size: 0.8rem; height: 32px;" autocomplete="off">
            </div>

            ${prodListHtml}
          </div>
        `;

        const editPsRatioInput = document.getElementById('editPsRatio');
        if (editPsRatioInput) {
          editPsRatioInput.addEventListener('input', () => {
            editPsRatioInput.value = editPsRatioInput.value.replace(/[^0-9/]/g, '');
          });
        }

        // Real-time product search inside edit modal
        const searchInput = document.getElementById('editReportProductSearch');
        const prodList = document.getElementById('editReportProdList');
        if (searchInput && prodList) {
          searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            const rows = prodList.querySelectorAll('.edit-prod-row');
            rows.forEach(row => {
              const sku = row.dataset.sku || '';
              const brand = row.dataset.brand || '';
              if (sku.includes(query) || brand.includes(query)) {
                row.style.display = 'flex';
              } else {
                row.style.display = 'none';
              }
            });
          });
        }
      } else {
        // Read Mode for PS On Trade
        let prodSalesHtml = '';
        if (report.companyProductSales) {
          Object.keys(report.companyProductSales).forEach(sku => {
            prodSalesHtml += `
              <div style="display: flex; justify-content: space-between; font-size: 0.82rem; border-bottom: 1px dotted var(--border-glass); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">${sku}</span>
                <span style="font-weight: 700; color: var(--text-primary);">${report.companyProductSales[sku]} chai</span>
              </div>
            `;
          });
        }
        if (!prodSalesHtml) {
          prodSalesHtml = '<div style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">Không có số bán rượu.</div>';
        }

        reportDetailBody.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(15, 23, 42, 0.01); padding: 15px; border-radius: 8px; border: 1px solid var(--border-glass);">
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên Outlet</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${report.outletName || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên PS</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: #a855f7;">${report.psName || '-'}</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Chương trình khuyến mãi</div>
              <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${report.promoName || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tỉ lệ bàn uống rượu</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${report.tableRatio || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Khách uống bia</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${report.beerCustCount || 0} khách</div>
            </div>
            <div style="grid-column: span 2;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Khách uống rượu đối thủ</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${report.competitorCustCount || 0} khách</div>
            </div>
          </div>

          <div style="margin-top: 10px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;"><i class="fa-solid fa-bottle-water" style="color: #a855f7; margin-right: 6px;"></i> Số lượng rượu bán ra:</div>
            <div style="display: flex; flex-direction: column; gap: 8px; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid var(--border-glass);">
              ${prodSalesHtml}
            </div>
          </div>
        `;
      }
    } else {
      if (editMode) {
        // Edit Mode for Event/Display
        reportDetailBody.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr; gap: 15px; background: rgba(15, 23, 42, 0.01); padding: 15px; border-radius: 8px; border: 1px solid var(--border-glass);">
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên Outlet / Event</label>
              <input type="text" id="editEventOutlet" class="input-control" value="${report.outletName || report.eventName || ''}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên chương trình</label>
              <input type="text" id="editEventProgram" class="input-control" value="${report.programName || ''}" style="font-size: 0.85rem; padding: 6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Loại hình hoạt động (Phân cách bằng dấu phẩy)</label>
              <input type="text" id="editEventTypes" class="input-control" value="${(report.eventTypes || []).join(', ')}" style="font-size: 0.85rem; padding: 6px 10px;" placeholder="Ví dụ: PG, Booth, Band...">
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Nội dung hoạt động</label>
              <textarea id="editEventContent" class="input-control" style="min-height: 100px; resize: vertical; font-size: 0.85rem; padding: 8px 10px;">${report.eventContent || ''}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Ngày bắt đầu</label>
                <input type="date" id="editEventStartDate" class="input-control" value="${report.startDate || ''}" style="font-size: 0.82rem; padding: 6px 10px;">
              </div>
              <div>
                <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Ngày kết thúc</label>
                <input type="date" id="editEventEndDate" class="input-control" value="${report.endDate || ''}" style="font-size: 0.82rem; padding: 6px 10px;">
              </div>
            </div>
            <div>
              <label class="form-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Cam đoan trung thực</label>
              <input type="text" id="editEventGuarantee" class="input-control" value="${report.guarantee || ''}" style="font-size: 0.82rem; padding: 6px 10px;">
            </div>
          </div>
        `;
      } else {
        // Read Mode for Event/Display
        let typesBadge = '';
        if (report.eventTypes) {
          typesBadge = report.eventTypes.map(t => `<span style="font-size: 0.72rem; background: rgba(79, 70, 229, 0.06); color: var(--primary-color); padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-right: 4px;">${t}</span>`).join('');
        }

        let imagesHtml = '';
        if (report.images && report.images.length > 0) {
          report.images.forEach(img => {
            imagesHtml += `<img src="${img}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-glass); cursor: pointer;" onclick="window.open('${img}')">`;
          });
        } else {
          imagesHtml = '<span style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">Không có hình ảnh.</span>';
        }

        reportDetailBody.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr; gap: 15px; background: rgba(15, 23, 42, 0.01); padding: 15px; border-radius: 8px; border: 1px solid var(--border-glass);">
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên Outlet / Event</div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${report.outletName || report.eventName || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Tên chương trình</div>
              <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${report.programName || '-'}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Loại hình hoạt động</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">${typesBadge}</div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Nội dung hoạt động</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line; margin-top: 4px;">${report.eventContent || '(Không có nội dung)'}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Ngày bắt đầu</div>
                <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">${report.startDate || 'Không áp dụng'}</div>
              </div>
              <div>
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Ngày kết thúc</div>
                <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">${report.endDate || 'Không áp dụng'}</div>
              </div>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Cam đoan trung thực</div>
              <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">${report.guarantee || 'Chưa cam đoan'}</div>
            </div>
          </div>

          <div style="margin-top: 10px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;"><i class="fa-regular fa-image" style="color: var(--primary-color); margin-right: 6px;"></i> Hình ảnh minh chứng:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid var(--border-glass);">
              ${imagesHtml}
            </div>
          </div>
        `;
      }
    }
  }

  if (btnEditReportDetail) {
    btnEditReportDetail.addEventListener('click', () => {
      if (!currentDetailReportId) return;
      const report = reports.find(r => r.id === currentDetailReportId);
      if (!report) return;

      isDetailEditMode = true;

      if (detailReportDateInput) detailReportDateInput.disabled = false;

      if (btnEditReportDetail) btnEditReportDetail.style.display = 'none';
      if (btnDeleteReportDetail) btnDeleteReportDetail.style.display = 'none';
      if (btnSaveReportDetail) btnSaveReportDetail.style.display = 'inline-flex';
      if (btnCancelReportDetail) btnCancelReportDetail.textContent = 'Hủy';

      renderReportDetailContent(report, true);
    });
  }

  if (btnCancelReportDetail) {
    btnCancelReportDetail.addEventListener('click', () => {
      if (isDetailEditMode) {
        const report = reports.find(r => r.id === currentDetailReportId);
        if (report) {
          isDetailEditMode = false;
          if (btnEditReportDetail) btnEditReportDetail.style.display = 'inline-flex';
          if (btnDeleteReportDetail) btnDeleteReportDetail.style.display = 'inline-flex';
          if (btnSaveReportDetail) btnSaveReportDetail.style.display = 'none';
          if (btnCancelReportDetail) btnCancelReportDetail.textContent = 'Đóng';
          if (detailReportDateInput) {
            detailReportDateInput.value = report.reportDate || (report.timestamp ? report.timestamp.split('T')[0] : '');
            detailReportDateInput.disabled = true;
          }
          renderReportDetailContent(report, false);
        }
      } else {
        reportDetailModal.style.display = 'none';
        currentDetailReportId = null;
      }
    });
  }

  if (btnDeleteReportDetail) {
    btnDeleteReportDetail.addEventListener('click', () => {
      if (!currentDetailReportId) return;
      const report = reports.find(r => r.id === currentDetailReportId);
      if (!report) return;

      const confirmDel = confirm("Bạn có chắc chắn muốn xóa báo cáo này?\nHành động này không thể hoàn tác.");
      if (!confirmDel) return;

      showToast('Đang xóa', 'Đang xóa báo cáo...', 'info', 2000);

      if (useFirebase) {
        // Try deleting images from Firebase Storage
        if (report.images && report.images.length > 0) {
          report.images.forEach(imgUrl => {
            try {
              if (imgUrl.startsWith('http')) {
                const fileRef = storage.refFromURL(imgUrl);
                fileRef.delete().catch(err => console.warn("Failed to delete storage image:", err));
              }
            } catch (e) {
              console.warn("Could not parse image URL for deletion:", e);
            }
          });
        }

        db.collection('reports').doc(currentDetailReportId).delete()
          .then(() => {
            reports = reports.filter(r => r.id !== currentDetailReportId);
            reportDetailModal.style.display = 'none';
            currentDetailReportId = null;
            showToast('Đã xóa', 'Xóa báo cáo thành công.', 'success');
            renderReportsTable();
          })
          .catch(err => {
            console.error("Firestore report delete error:", err);
            showToast('Lỗi', 'Không thể xóa báo cáo từ cơ sở dữ liệu.', 'error');
          });
      } else {
        reports = reports.filter(r => r.id !== currentDetailReportId);
        localStorage.setItem('diageo_reports', JSON.stringify(reports));
        reportDetailModal.style.display = 'none';
        currentDetailReportId = null;
        showToast('Đã xóa', 'Xóa báo cáo thành công.', 'success');
        renderReportsTable();
      }
    });
  }

  if (btnSaveReportDetail) {
    btnSaveReportDetail.addEventListener('click', () => {
      if (!currentDetailReportId) return;
      const report = reports.find(r => r.id === currentDetailReportId);
      if (!report) return;

      const newDateVal = detailReportDateInput.value;
      if (!newDateVal) {
        showToast('Trống ngày', 'Vui lòng chọn ngày báo cáo.', 'warning');
        return;
      }

      const updatedFields = {
        reportDate: newDateVal
      };

      if (report.activityType === 'PS') {
        const editPsOutlet = document.getElementById('editPsOutlet');
        const editPsName = document.getElementById('editPsName');
        const editPsPromo = document.getElementById('editPsPromo');
        const editPsRatio = document.getElementById('editPsRatio');
        const editPsBeerCust = document.getElementById('editPsBeerCust');
        const editPsCompetitorCust = document.getElementById('editPsCompetitorCust');

        if (!editPsOutlet || !editPsOutlet.value.trim()) {
          showToast('Thông tin trống', 'Tên Outlet không được để trống.', 'warning');
          return;
        }
        if (!editPsName || !editPsName.value.trim()) {
          showToast('Thông tin trống', 'Tên PS không được để trống.', 'warning');
          return;
        }
        if (!editPsPromo || !editPsPromo.value.trim()) {
          showToast('Thông tin trống', 'Chương trình KM không được để trống.', 'warning');
          return;
        }
        if (!editPsRatio || !editPsRatio.value.trim()) {
          showToast('Thông tin trống', 'Tỉ lệ bàn không được để trống.', 'warning');
          return;
        }
        const ratioRegex = /^\d+\/\d+$/;
        if (!ratioRegex.test(editPsRatio.value.trim())) {
          showToast('Định dạng sai', 'Tỉ lệ bàn phải đúng định dạng số/số (ví dụ: 12/24).', 'warning');
          return;
        }

        updatedFields.outletName = editPsOutlet.value.trim();
        updatedFields.psName = editPsName.value.trim();
        updatedFields.promoName = editPsPromo.value.trim();
        updatedFields.tableRatio = editPsRatio.value.trim();
        updatedFields.beerCustCount = parseInt(editPsBeerCust.value) || 0;
        updatedFields.competitorCustCount = parseInt(editPsCompetitorCust.value) || 0;

        // Parse product sales quantities
        const companyProductSales = {};
        let totalQty = 0;
        document.querySelectorAll('.edit-ps-qty-input').forEach(input => {
          const sku = input.dataset.sku;
          const qty = parseInt(input.value) || 0;
          if (qty > 0) {
            companyProductSales[sku] = qty;
            totalQty += qty;
          }
        });
        if (totalQty === 0) {
          showToast('Số lượng trống', 'Vui lòng nhập ít nhất 1 sản phẩm bán ra.', 'warning');
          return;
        }
        updatedFields.companyProductSales = companyProductSales;

      } else {
        // Event/Display
        const editEventOutlet = document.getElementById('editEventOutlet');
        const editEventProgram = document.getElementById('editEventProgram');
        const editEventTypes = document.getElementById('editEventTypes');
        const editEventContent = document.getElementById('editEventContent');
        const editEventStartDate = document.getElementById('editEventStartDate');
        const editEventEndDate = document.getElementById('editEventEndDate');
        const editEventGuarantee = document.getElementById('editEventGuarantee');

        if (!editEventOutlet || !editEventOutlet.value.trim()) {
          showToast('Thông tin trống', 'Tên Outlet/Event không được để trống.', 'warning');
          return;
        }

        updatedFields.outletName = editEventOutlet.value.trim();
        updatedFields.eventName = editEventOutlet.value.trim();
        updatedFields.programName = editEventProgram ? editEventProgram.value.trim() : '';
        updatedFields.eventContent = editEventContent ? editEventContent.value.trim() : '';
        updatedFields.startDate = editEventStartDate ? editEventStartDate.value : '';
        updatedFields.endDate = editEventEndDate ? editEventEndDate.value : '';
        updatedFields.guarantee = editEventGuarantee ? editEventGuarantee.value.trim() : '';

        if (editEventTypes) {
          const typesArr = editEventTypes.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
          updatedFields.eventTypes = typesArr;
        }
      }

      if (useFirebase) {
        db.collection('reports').doc(currentDetailReportId).update(updatedFields)
          .then(() => {
            Object.assign(report, updatedFields);
            reportDetailModal.style.display = 'none';
            showToast('Đã lưu', 'Cập nhật nội dung báo cáo thành công.', 'success');
            renderReportsTable();
          })
          .catch(err => {
            console.error("Firestore report update error:", err);
            showToast('Lỗi', 'Không thể lưu thay đổi vào cơ sở dữ liệu đám mây.', 'error');
          });
      } else {
        Object.assign(report, updatedFields);
        localStorage.setItem('diageo_reports', JSON.stringify(reports));
        reportDetailModal.style.display = 'none';
        renderReportsTable();
        showToast('Đã lưu', 'Cập nhật nội dung báo cáo thành công.', 'success');
      }
    });
  }

  // ----------------------------------------------------
  // Products CRUD Logic
  // ----------------------------------------------------
  function renderProductsCrudList() {
    if (!productCrudList) return;
    productCrudList.innerHTML = '';

    const filterVal = adminProductSearch ? adminProductSearch.value.trim().toLowerCase() : '';
    
    const grouped = {};
    allProducts.forEach(prod => {
      if (!grouped[prod.brand]) {
        grouped[prod.brand] = [];
      }
      grouped[prod.brand].push(prod);
    });

    let hasProducts = false;

    Object.keys(grouped).sort().forEach(brand => {
      const prods = grouped[brand].sort((a,b) => a.sku.localeCompare(b.sku));
      const filtered = prods.filter(p => 
        p.sku.toLowerCase().includes(filterVal) || p.brand.toLowerCase().includes(filterVal)
      );

      if (filtered.length === 0) return;
      hasProducts = true;

      const brandHeader = document.createElement('div');
      brandHeader.style.cssText = 'background: #f1f5f9; padding: 8px 12px; font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-glass);';
      brandHeader.textContent = brand;
      productCrudList.appendChild(brandHeader);

      filtered.forEach((prod, index) => {
        const item = document.createElement('div');
        item.className = 'program-crud-item';
        item.style.cssText = 'padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-glass);';
        
        item.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-primary);">${prod.sku}</span>
            ${prod.price ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">Giá: ${Number(prod.price).toLocaleString('vi-VN')}</span>` : ''}
          </div>
          <div class="program-crud-actions">
            <button type="button" class="btn-crud-action btn-product-edit" data-id="${prod.id}" title="Sửa sản phẩm">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-crud-action btn-product-delete" data-id="${prod.id}" title="Xóa">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;

        const overallIdx = allProducts.findIndex(p => p.id === prod.id);

        item.querySelector('.btn-product-edit').addEventListener('click', () => {
          editProductBrandInput.value = prod.brand;
          editProductSkuInput.value = prod.sku;
          if (editProductPriceInput) editProductPriceInput.value = prod.price || '';
          editProductIndex.value = overallIdx;
          editProductModal.style.display = 'flex';
          editProductBrandInput.focus();
        });

        item.querySelector('.btn-product-delete').addEventListener('click', () => {
          if (confirm(`Bạn chắc chắn muốn xóa sản phẩm rượu: "${prod.sku}"?`)) {
            if (useFirebase) {
              db.collection('products').doc(prod.id).delete().then(() => {
                showToast('Đã xóa', 'Xóa sản phẩm thành công.', 'success');
              }).catch(err => {
                console.error("Firestore product delete error:", err);
                showToast('Lỗi', 'Không thể xóa sản phẩm.', 'error');
              });
            } else {
              allProducts.splice(overallIdx, 1);
              localStorage.setItem('diageo_products', JSON.stringify(allProducts));
              renderProductsCrudList();
              renderPsProductGrid();
              showToast('Đã xóa', 'Xóa sản phẩm thành công.', 'success');
            }
          }
        });

        productCrudList.appendChild(item);
      });
    });

    if (!hasProducts) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 15px; text-align: center; color: var(--text-muted); font-size: 0.85rem;';
      empty.textContent = filterVal ? 'Không tìm thấy sản phẩm nào khớp.' : 'Chưa có sản phẩm nào.';
      productCrudList.appendChild(empty);
    }
  }

  if (btnAddProduct) {
    btnAddProduct.addEventListener('click', () => {
      const brand = newProductBrandInput.value.trim();
      const sku = newProductSkuInput.value.trim();
      const price = newProductPriceInput ? newProductPriceInput.value.trim() : '';

      if (!brand || !sku) {
        showToast('Thông tin trống', 'Vui lòng nhập cả Brand và Tên sản phẩm SKU.', 'warning');
        return;
      }

      const duplicate = allProducts.some(p => p.sku.toLowerCase() === sku.toLowerCase());
      if (duplicate) {
        showToast('Trùng lặp', 'Sản phẩm này đã tồn tại.', 'warning');
        return;
      }

      const prodId = `prod_${Date.now()}`;
      const newProduct = { brand, sku, price };

      if (useFirebase) {
        db.collection('products').doc(prodId).set(newProduct).then(() => {
          newProductBrandInput.value = '';
          newProductSkuInput.value = '';
          if (newProductPriceInput) newProductPriceInput.value = '';
          showToast('Đã thêm', 'Thêm sản phẩm thành công.', 'success');
        }).catch(err => {
          console.error("Firestore product add error:", err);
          showToast('Lỗi', 'Không thể thêm sản phẩm.', 'error');
        });
      } else {
        newProduct.id = prodId;
        allProducts.push(newProduct);
        localStorage.setItem('diageo_products', JSON.stringify(allProducts));
        newProductBrandInput.value = '';
        newProductSkuInput.value = '';
        if (newProductPriceInput) newProductPriceInput.value = '';
        renderProductsCrudList();
        renderPsProductGrid();
        showToast('Đã thêm', 'Thêm sản phẩm thành công.', 'success');
      }
    });
  }

  if (btnCancelEditProduct) {
    btnCancelEditProduct.addEventListener('click', () => {
      editProductModal.style.display = 'none';
    });
  }

  if (btnSaveEditProduct) {
    btnSaveEditProduct.addEventListener('click', () => {
      const brand = editProductBrandInput.value.trim();
      const sku = editProductSkuInput.value.trim();
      const price = editProductPriceInput ? editProductPriceInput.value.trim() : '';
      const idx = parseInt(editProductIndex.value);
      const prod = allProducts[idx];

      if (!brand || !sku) {
        showToast('Thông tin trống', 'Không được bỏ trống Brand hoặc SKU.', 'warning');
        return;
      }

      const duplicate = allProducts.some((p, i) => p.sku.toLowerCase() === sku.toLowerCase() && i !== idx);
      if (duplicate) {
        showToast('Trùng lặp', 'Sản phẩm này đã tồn tại.', 'warning');
        return;
      }

      if (useFirebase) {
        db.collection('products').doc(prod.id).update({ brand, sku, price }).then(() => {
          editProductModal.style.display = 'none';
          showToast('Đã cập nhật', 'Cập nhật sản phẩm thành công.', 'success');
        }).catch(err => {
          console.error("Firestore product update error:", err);
          showToast('Lỗi', 'Không thể cập nhật sản phẩm.', 'error');
        });
      } else {
        allProducts[idx].brand = brand;
        allProducts[idx].sku = sku;
        allProducts[idx].price = price;
        localStorage.setItem('diageo_products', JSON.stringify(allProducts));
        editProductModal.style.display = 'none';
        renderProductsCrudList();
        renderPsProductGrid();
        showToast('Đã cập nhật', 'Cập nhật sản phẩm thành công.', 'success');
      }
    });
  }

  if (adminProductSearch) {
    adminProductSearch.addEventListener('input', () => {
      renderProductsCrudList();
    });
  }

  // ----------------------------------------------------
  // 11. Program CRUD Logic
  // ----------------------------------------------------
  // ----------------------------------------------------
  // 11. Program CRUD Logic
  // ----------------------------------------------------
  function renderProgramCrudList() {
    programCrudList.innerHTML = '';
    
    samplePrograms.forEach((prog, index) => {
      const item = document.createElement('div');
      item.className = 'program-crud-item';
      
      const psDisplay = prog.psNames && prog.psNames.length > 0 
        ? ` <span style="font-size: 0.72rem; color: #a855f7; font-weight: 600;">(${prog.psNames.join(', ')})</span>` 
        : ' <span style="font-size: 0.72rem; color: var(--text-muted); font-style: italic;">(Chưa gán PS)</span>';

      item.innerHTML = `
        <span class="program-crud-name" title="${prog.name}">${prog.name}${psDisplay}</span>
        <div class="program-crud-actions">
          <button type="button" class="btn-crud-action btn-crud-edit" data-index="${index}" title="Sửa Outlet">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button type="button" class="btn-crud-action btn-crud-delete" data-index="${index}" title="Xóa">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      
      // Add edit action listener
      item.querySelector('.btn-crud-edit').addEventListener('click', () => {
        editProgramNameInput.value = prog.name;
        editProgramPsNamesInput.value = prog.psNames ? prog.psNames.join(', ') : '';
        editProgramIndex.value = index;
        editProgramModal.classList.add('active');
        editProgramNameInput.focus();
      });
      
      // Add delete action listener
      item.querySelector('.btn-crud-delete').addEventListener('click', () => {
        if (confirm(`Bạn chắc chắn muốn xóa Outlet: "${prog.name}"?`)) {
          if (useFirebase) {
            db.collection('programs').doc(prog.id).delete().then(() => {
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
    const psNamesStr = newProgramPsNamesInput.value.trim();
    if (!newName) {
      showToast('Thông tin trống', 'Vui lòng nhập tên Outlet.', 'warning');
      return;
    }
    
    if (samplePrograms.some(p => p.name === newName)) {
      showToast('Trùng lặp', 'Tên Outlet này đã tồn tại.', 'warning');
      return;
    }

    const psNamesVal = psNamesStr ? psNamesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    if (useFirebase) {
      db.collection('programs').add({ name: newName, psNames: psNamesVal }).then(() => {
        newProgramNameInput.value = '';
        newProgramPsNamesInput.value = '';
        showToast('Đã thêm', 'Thêm Outlet mới thành công.', 'success');
      }).catch(err => {
        console.error("Firestore add error:", err);
        showToast('Lỗi', 'Không thể thêm Outlet vào đám mây.', 'error');
      });
    } else {
      samplePrograms.push({
        id: `prog_${Date.now()}`,
        name: newName,
        psNames: psNamesVal
      });
      localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
      newProgramNameInput.value = '';
      newProgramPsNamesInput.value = '';
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
    const updatedPsNamesStr = editProgramPsNamesInput.value.trim();
    const index = parseInt(editProgramIndex.value);
    const prog = samplePrograms[index];
    
    if (!updatedName) {
      showToast('Thông tin trống', 'Tên Outlet không được để trống.', 'warning');
      return;
    }
    
    // Check duplication with other items
    const duplicate = samplePrograms.some((p, idx) => p.name === updatedName && idx !== index);
    if (duplicate) {
      showToast('Trùng lặp', 'Tên Outlet này đã tồn tại.', 'warning');
      return;
    }

    const psNamesVal = updatedPsNamesStr ? updatedPsNamesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    if (useFirebase) {
      db.collection('programs').doc(prog.id).update({ 
        name: updatedName,
        psNames: psNamesVal
      }).then(() => {
        editProgramModal.classList.remove('active');
        showToast('Đã cập nhật', 'Cập nhật Outlet thành công.', 'success');
      }).catch(err => {
        console.error("Firestore update error:", err);
        showToast('Lỗi', 'Không thể cập nhật Outlet trên đám mây.', 'error');
      });
    } else {
      samplePrograms[index].name = updatedName;
      samplePrograms[index].psNames = psNamesVal;
      localStorage.setItem('diageo_programs', JSON.stringify(samplePrograms));
      editProgramModal.classList.remove('active');
      renderProgramCrudList();
      showToast('Đã cập nhật', 'Cập nhật Outlet thành công.', 'success');
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
      return Promise.resolve({ success: true, base64, dataUrl: imgSrc, originalSrc: imgSrc });
    }

    // Case 2: Remote HTTP/HTTPS URL
    if (imgSrc.startsWith('http')) {
      const proxies = [
        `https://images.weserv.nl/?url=${encodeURIComponent(imgSrc)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(imgSrc)}`,
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
              resolve({ success: true, base64, dataUrl, originalSrc: imgSrc });
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

  // Excel XLSX Export for Products Catalog
  if (btnExportProductsExcel) {
    btnExportProductsExcel.addEventListener('click', async () => {
      if (!allProducts || allProducts.length === 0) {
        showToast('Không có dữ liệu', 'Danh mục sản phẩm đang trống.', 'warning');
        return;
      }

      showToast('Đang tạo file', 'Vui lòng đợi trong giây lát...', 'info');

      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Diageo VN';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Products Catalog');

        worksheet.columns = [
          { header: 'Nhóm Brand', key: 'brand', width: 25 },
          { header: 'Tên sản phẩm (SKU)', key: 'sku', width: 35 },
          { header: 'Giá (VND)', key: 'price', width: 20 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Group and sort by Brand then SKU
        const grouped = {};
        allProducts.forEach(prod => {
          if (!grouped[prod.brand]) grouped[prod.brand] = [];
          grouped[prod.brand].push(prod);
        });

        Object.keys(grouped).sort().forEach(brand => {
          const prods = grouped[brand].sort((a,b) => a.sku.localeCompare(b.sku));
          prods.forEach(prod => {
            const rowData = {
              brand: prod.brand,
              sku: prod.sku,
              price: prod.price ? Number(prod.price) : ''
            };
            const row = worksheet.addRow(rowData);
            row.getCell('price').numFmt = '#,##0'; // format number with commas
            row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Danh_Muc_San_Pham_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Thành công', 'Đã tải xuống danh mục sản phẩm.', 'success');
      } catch (err) {
        console.error('Lỗi khi xuất Excel Products:', err);
        showToast('Lỗi', 'Không thể tạo file Excel.', 'error');
      }
    });
  }

  // Excel XLSX Export with Images using ExcelJS
  // Excel XLSX Export with Images using ExcelJS (Only for Trưng bày / Event)
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      const eventReports = reports.filter(r => r.activityType !== 'PS');
      if (eventReports.length === 0) {
        showToast('Không có dữ liệu', 'Không có báo cáo Trưng bày / Event nào để xuất.', 'warning');
        return;
      }

      showToast('Đang tạo XLSX', 'Đang thiết lập bảng tính...', 'info', 3000);

      const eventCleanPromises = eventReports.map(report => {
        const imagePromises = (report.images || []).map(imgSrc => cleanImageForExport(imgSrc));
        return Promise.all(imagePromises).then(cleanedImages => {
          return { ...report, cleanedImages };
        });
      });

      Promise.all(eventCleanPromises)
        .then(cleanedEventReports => {
          const workbook = new ExcelJS.Workbook();

          // Sheet 1: Event Activation
          const wsEvent = workbook.addWorksheet('Bao cao Activation');
          wsEvent.views = [{ showGridLines: true }];

          let maxImages = 4;
          cleanedEventReports.forEach(r => {
            if (r.cleanedImages && r.cleanedImages.length > maxImages) {
              maxImages = r.cleanedImages.length;
            }
          });

          const eventColumns = [
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
            eventColumns.push({ header: `Ảnh minh chứng ${i}`, key: `img${i}`, width: 24 });
          }
          wsEvent.columns = eventColumns;

          const headerRowEvent = wsEvent.getRow(1);
          headerRowEvent.height = 30;
          headerRowEvent.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' }, name: 'Segoe UI', size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'CBD5E1' } },
              left: { style: 'thin', color: { argb: 'CBD5E1' } },
              bottom: { style: 'medium', color: { argb: '475569' } },
              right: { style: 'thin', color: { argb: 'CBD5E1' } }
            };
          });

          cleanedEventReports.forEach((report) => {
            const row = wsEvent.addRow({
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

            for (let colNum = 1; colNum <= eventColumns.length; colNum++) {
              const cell = row.getCell(colNum);
              cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
              const isCenter = colNum === 1 || colNum === 3 || colNum === 5 || colNum === 6 || colNum === 9 || colNum === 10 || colNum >= 11;
              cell.alignment = { vertical: 'middle', horizontal: isCenter ? 'center' : 'left', wrapText: true };
              cell.border = {
                top: { style: 'thin', color: { argb: 'F1F5F9' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
              };
            }

            report.cleanedImages.forEach((imgResult, imgIdx) => {
              if (imgResult.success) {
                try {
                  const imageId = workbook.addImage({ base64: imgResult.base64, extension: 'jpeg' });
                  wsEvent.addImage(imageId, {
                    tl: { col: 10 + imgIdx, row: row.number - 1 },
                    ext: { width: 120, height: 90 },
                    editAs: 'oneCell'
                  });
                } catch (e) {
                  console.error("Error adding image to cell:", e);
                }
              } else {
                wsEvent.getCell(row.number, 11 + imgIdx).value = {
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
          link.setAttribute("download", `Diageo_Activation_Export_${Date.now()}.xlsx`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('Xuất Excel thành công', 'File Excel báo cáo Trưng bày / Event đã tải xuống.', 'success');
        })
        .catch(err => {
          console.error("ExcelJS export error:", err);
          showToast('Lỗi xuất Excel', 'Không thể tạo file Excel.', 'error');
        });
    });
  }

  // Excel XLSX Raw Data Export (Only for PS On Trade) - One row per SKU
  if (btnExportPsExcel) {
    btnExportPsExcel.addEventListener('click', () => {
      const psReports = reports.filter(r => r.activityType === 'PS');
      if (psReports.length === 0) {
        showToast('Không có dữ liệu', 'Không có báo cáo PS On Trade nào để xuất.', 'warning');
        return;
      }

      showToast('Đang tạo XLSX', 'Đang thiết lập bảng tính...', 'info', 3000);

      const workbook = new ExcelJS.Workbook();
      const wsPs = workbook.addWorksheet('Bao cao PS On Trade');
      wsPs.views = [{ showGridLines: true }];

      const psColumns = [
        { header: 'Ngày báo cáo', key: 'reportDate', width: 15 },
        { header: 'Tên Outlet', key: 'outletName', width: 35 },
        { header: 'Tên PS', key: 'psName', width: 25 },
        { header: 'Chương trình KM', key: 'promoName', width: 35 },
        { header: 'Tỉ lệ bàn uống rượu', key: 'tableRatio', width: 22 },
        { header: 'Khách uống bia', key: 'beerCustCount', width: 18 },
        { header: 'Khách rượu đối thủ', key: 'competitorCustCount', width: 22 },
        { header: 'Sản phẩm rượu công ty', key: 'sku', width: 35 },
        { header: 'Số lượng bán (chai)', key: 'qty', width: 22 },
        { header: 'Thời gian gửi', key: 'timestamp', width: 22 }
      ];
      wsPs.columns = psColumns;

      const headerRowPs = wsPs.getRow(1);
      headerRowPs.height = 30;
      headerRowPs.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, name: 'Segoe UI', size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '9333EA' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'CBD5E1' } },
          left: { style: 'thin', color: { argb: 'CBD5E1' } },
          bottom: { style: 'medium', color: { argb: '475569' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } }
        };
      });

      psReports.forEach((report) => {
        const salesMap = report.companyProductSales || {};
        Object.keys(salesMap).forEach((sku) => {
          const qty = salesMap[sku];
          const row = wsPs.addRow({
            reportDate: report.reportDate ? formatDate(report.reportDate) : '-',
            outletName: report.outletName || '-',
            psName: report.psName || '-',
            promoName: report.promoName || '-',
            tableRatio: report.tableRatio || '-',
            beerCustCount: report.beerCustCount || 0,
            competitorCustCount: report.competitorCustCount || 0,
            sku: sku,
            qty: qty,
            timestamp: new Date(report.timestamp).toLocaleString('vi-VN')
          });

          row.height = 24;
          for (let colNum = 1; colNum <= psColumns.length; colNum++) {
            const cell = row.getCell(colNum);
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
            const isCenter = colNum === 1 || colNum === 5 || colNum === 6 || colNum === 7 || colNum === 9 || colNum === 10;
            cell.alignment = { vertical: 'middle', horizontal: isCenter ? 'center' : 'left', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'F1F5F9' } },
              left: { style: 'thin', color: { argb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
              right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
          }
        });
      });

      workbook.xlsx.writeBuffer()
        .then(buffer => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `Diageo_PS_OnTrade_RawData_${Date.now()}.xlsx`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('Xuất Excel thành công', 'File Excel raw data báo cáo PS On Trade đã tải xuống.', 'success');
        })
        .catch(err => {
          console.error("ExcelJS export error:", err);
          showToast('Lỗi xuất Excel', 'Không thể tạo file Excel.', 'error');
        });
    });
  }

  // PowerPoint Slide Export
  btnExportPPT.addEventListener('click', () => {
    const eventReports = reports.filter(r => r.activityType !== 'PS');
    if (eventReports.length === 0) {
      showToast('Không có dữ liệu', 'Không có báo cáo Trưng bày / Event nào để xuất PowerPoint.', 'warning');
      return;
    }

    showToast('Dang tao PPTX', 'Dang thiet lap bo cuc slide PowerPoint...', 'info', 2000);

    const eventCleanPromises = eventReports.map(report => {
      const imagePromises = (report.images || []).map(imgSrc => cleanImageForExport(imgSrc));
      return Promise.all(imagePromises).then(cleanedImages => {
        return { ...report, cleanedImages };
      });
    });

    Promise.all(eventCleanPromises)
      .then(cleanedEventReports => {
        let pptx = new PptxGenJS();
        pptx.title = "Diageo On-Trade Activation Report";
        pptx.layout = "LAYOUT_16x9";

        // Build slide order based on event reports only
        cleanedEventReports.forEach((cleanedReport, index) => {
          const images = cleanedReport.cleanedImages || [];
          const imagesPerSlide = 6;
          const totalSlidesForReport = Math.max(1, Math.ceil(images.length / imagesPerSlide));

          for (let slideIdx = 0; slideIdx < totalSlidesForReport; slideIdx++) {
            let slide = pptx.addSlide();

            slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.9, fill: { color: "4f46e5" } });
            slide.addText("DIAGEO ON-TRADE CONTRACTED PROGRAM", { x: 0.5, y: 0.15, fontSize: 11, bold: true, color: "fbbf24" });
            const pageSuffix = totalSlidesForReport > 1 ? ` (Trang ${slideIdx + 1}/${totalSlidesForReport})` : "";
            slide.addText(`BAO CAO ACTIVATION #${index + 1}${pageSuffix}`, { x: 0.5, y: 0.42, fontSize: 18, bold: true, color: "ffffff" });

            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.5, y: 1.2, w: 4.0, h: 4.8,
              fill: { color: "f8fafc" }, line: { color: "cbd5e1", width: 1 }, radius: 0.05
            });

            let textRuns = [];
            if (cleanedReport.activityType === 'Display') {
              textRuns = [
                { text: "TEN OUTLET:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: (cleanedReport.outletName || cleanedReport.eventName || '-') + "\n\n", options: { color: "334155", fontSize: 9.5, bold: true } },
                { text: "LOAI HOAT DONG:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: "Trung bay (Display)\n\n", options: { color: "6366f1", bold: true, fontSize: 9.5 } },
                { text: "TRANG THAI XAC THUC:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${cleanedReport.guarantee} tai thoi diem vieng tham`, options: { color: "64748b", italic: true, fontSize: 8.5 } }
              ];
            } else {
              textRuns = [
                { text: "TEN OUTLET:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: (cleanedReport.outletName || cleanedReport.eventName || '-') + "\n", options: { color: "334155", fontSize: 9.0, bold: true } },
                { text: "TEN CHUONG TRINH:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: (cleanedReport.programName || '-') + "\n", options: { color: "334155", fontSize: 9.0, bold: true } },
                { text: "THOI GIAN DIEN RA:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${formatDate(cleanedReport.startDate)} - ${formatDate(cleanedReport.endDate)}\n`, options: { color: "475569", fontSize: 8.5 } },
                { text: "LOAI HINH HOAT DONG:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${cleanedReport.eventTypes ? cleanedReport.eventTypes.join(', ') : '-'}\n`, options: { color: "6366f1", bold: true, fontSize: 8.5 } },
                { text: "NOI DUNG TOM TAT:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${cleanedReport.eventContent || '(Khong co tom tat)'}\n`, options: { color: "475569", fontSize: 8.5 } },
                { text: "TRANG THAI XAC THUC:\n", options: { bold: true, color: "1e293b", fontSize: 8.0 } },
                { text: `${cleanedReport.guarantee} tai thoi diem vieng tham`, options: { color: "64748b", italic: true, fontSize: 8.0 } }
              ];
            }

            slide.addText(textRuns, { x: 0.7, y: 1.35, w: 3.6, h: 4.5, valign: "top" });

            const galleryTitle = cleanedReport.activityType === 'Display' ? 'HINH ANH MINH CHUNG TRUNG BAY' : 'HINH ANH MINH CHUNG SU KIEN';
            slide.addText(`${galleryTitle}${pageSuffix.toUpperCase()}`, {
              x: 4.8, y: 1.2, w: 8.0, fontSize: 10, bold: true, color: "4f46e5"
            });

            const startImgIdx = slideIdx * imagesPerSlide;
            const slideImages = images.slice(startImgIdx, startImgIdx + imagesPerSlide);

            slideImages.forEach((imgResult, imgIdx) => {
              const col = imgIdx % 3;
              const row = Math.floor(imgIdx / 3);
              const imgW = 2.4, imgH = 1.8, gapX = 0.2, gapY = 0.2;
              const posX = 4.8 + col * (imgW + gapX);
              const posY = 1.5 + row * (imgH + gapY);

              if (imgResult.success && imgResult.dataUrl) {
                const pptImgData = imgResult.dataUrl.replace('data:', '');
                slide.addImage({ data: pptImgData, x: posX, y: posY, w: imgW, h: imgH });
              } else {
                slide.addShape(pptx.ShapeType.rect, {
                  x: posX, y: posY, w: imgW, h: imgH,
                  fill: { color: "fee2e2" }, line: { color: "fca5a5", width: 1 }
                });
                slide.addText("Anh loi/ngoai tuyen", {
                  x: posX, y: posY, w: imgW, h: imgH,
                  fontSize: 8.5, color: "ef4444", align: "center", valign: "middle"
                });
              }
            });
          }
        });

        return pptx.writeFile({ fileName: `Diageo_Activation_Report_Export_${Date.now()}.pptx` });
      })
      .then(() => {
        showToast('Xuat PowerPoint thanh cong', 'File bao cao .pptx da duoc tai xuong.', 'success');
      })
      .catch(err => {
        console.error("PPTX export error:", err);
        showToast('Loi xuat PPTX', 'Khong the tao file slide bao cao.', 'error');
      });
  });

  // ----------------------------------------------------
  // PS On Trade Form Interactivity & Logic
  // ----------------------------------------------------
  const psFormContainer = document.getElementById('psFormContainer');
  const psForm = document.getElementById('psForm');
  const psReportDateInput = document.getElementById('psReportDate');
  const psOutletInput = document.getElementById('psOutletInput');
  const psOutletAutocompleteList = document.getElementById('psOutletAutocompleteList');
  const psNameSelect = document.getElementById('psNameSelect');
  const psPromoInput = document.getElementById('psPromoInput');
  const psRatioInput = document.getElementById('psRatioInput');
  const psBeerCustInput = document.getElementById('psBeerCustInput');
  const psCompetitorCustInput = document.getElementById('psCompetitorCustInput');
  const psProductSearch = document.getElementById('psProductSearch');
  const psProductGrid = document.getElementById('psProductGrid');
  const btnPsSubmit = document.getElementById('btnPsSubmit');
  const btnPsBackToLanding = document.getElementById('btnPsBackToLanding');
  
  // PS Success screen elements
  const psSuccessScreen = document.getElementById('psSuccessScreen');
  const sumPsDate = document.getElementById('sumPsDate');
  const sumPsOutlet = document.getElementById('sumPsOutlet');
  const sumPsName = document.getElementById('sumPsName');
  const sumPsPromo = document.getElementById('sumPsPromo');
  const sumPsRatio = document.getElementById('sumPsRatio');
  const sumPsBeerCust = document.getElementById('sumPsBeerCust');
  const sumPsCompetitorCust = document.getElementById('sumPsCompetitorCust');
  const sumPsProductsList = document.getElementById('sumPsProductsList');
  const btnPsNewReport = document.getElementById('btnPsNewReport');
  const btnPsSuccessBackToSelection = document.getElementById('btnPsSuccessBackToSelection');

  // Track quantities of products entered by user: key is product SKU, value is quantity (number)
  let psProductQuantities = {};

  // Setup current date on load
  function setPsCurrentDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    if (psReportDateInput) {
      psReportDateInput.value = `${dd}/${mm}/${yyyy}`;
    }
  }

  function renderPsProductGrid() {
    if (!psProductGrid) return;
    psProductGrid.innerHTML = '';
    
    // Group products by brand
    const grouped = {};
    allProducts.forEach(prod => {
      if (!grouped[prod.brand]) {
        grouped[prod.brand] = [];
      }
      grouped[prod.brand].push(prod);
    });

    const searchVal = (psProductSearch ? psProductSearch.value.trim().toLowerCase() : '');

    // For each brand
    Object.keys(grouped).sort().forEach(brand => {
      const brandProducts = grouped[brand].sort((a,b) => a.sku.localeCompare(b.sku));
      
      // Filter products based on searchVal
      const filtered = brandProducts.filter(prod => 
        prod.sku.toLowerCase().includes(searchVal) || prod.brand.toLowerCase().includes(searchVal)
      );

      // If no matching products in this brand, skip rendering
      if (filtered.length === 0) return;

      const item = document.createElement('div');
      item.className = 'brand-accordion-item active';

      const header = document.createElement('div');
      header.className = 'brand-accordion-header';
      header.innerHTML = `
        <span>${brand} (${filtered.length})</span>
        <i class="fa-solid fa-chevron-down brand-accordion-icon"></i>
      `;
      
      const content = document.createElement('div');
      content.className = 'brand-accordion-content';
      content.style.display = 'flex';

      filtered.forEach(prod => {
        const row = document.createElement('div');
        row.className = 'product-input-row';
        
        // Initialize quantity
        if (psProductQuantities[prod.sku] === undefined) {
          psProductQuantities[prod.sku] = 0;
        }

        row.innerHTML = `
          <span class="product-sku-name">${prod.sku}</span>
          <div class="product-qty-wrapper">
            <button type="button" class="product-qty-btn qty-minus" data-sku="${prod.sku}"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="product-qty-input" data-sku="${prod.sku}" min="0" value="${psProductQuantities[prod.sku]}">
            <button type="button" class="product-qty-btn qty-plus" data-sku="${prod.sku}"><i class="fa-solid fa-plus"></i></button>
          </div>
        `;

        // Minus button listener
        row.querySelector('.qty-minus').addEventListener('click', () => {
          const input = row.querySelector('.product-qty-input');
          let val = parseInt(input.value) || 0;
          if (val > 0) {
            val--;
            input.value = val;
            psProductQuantities[prod.sku] = val;
          }
        });

        // Plus button listener
        row.querySelector('.qty-plus').addEventListener('click', () => {
          const input = row.querySelector('.product-qty-input');
          let val = parseInt(input.value) || 0;
          val++;
          input.value = val;
          psProductQuantities[prod.sku] = val;
        });

        // Input change listener
        row.querySelector('.product-qty-input').addEventListener('input', (e) => {
          let val = parseInt(e.target.value) || 0;
          if (val < 0) val = 0;
          e.target.value = val;
          psProductQuantities[prod.sku] = val;
        });

        content.appendChild(row);
      });

      header.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        if (isActive) {
          item.classList.remove('active');
          content.style.display = 'none';
        } else {
          item.classList.add('active');
          content.style.display = 'flex';
        }
      });

      item.appendChild(header);
      item.appendChild(content);
      psProductGrid.appendChild(item);
    });
  }

  // Live search products filter
  if (psProductSearch) {
    psProductSearch.addEventListener('input', () => {
      renderPsProductGrid();
    });
  }

  // Autocomplete search for Outlets on PS Form
  let activePsItemIndex = -1;

  function renderPsOutletAutocomplete(filterText = '') {
    if (!psOutletAutocompleteList) return;
    psOutletAutocompleteList.innerHTML = '';
    activePsItemIndex = -1;

    const filtered = samplePrograms.filter(prog => 
      prog.name.toLowerCase().includes(filterText.toLowerCase()) &&
      prog.psNames &&
      prog.psNames.length > 0
    );

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'autocomplete-no-results';
      emptyDiv.textContent = 'Không tìm thấy Outlet nào...';
      psOutletAutocompleteList.appendChild(emptyDiv);
    } else {
      filtered.forEach((prog, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = prog.name;
        item.dataset.index = index;

        item.addEventListener('click', () => {
          selectPsOutlet(prog);
        });

        psOutletAutocompleteList.appendChild(item);
      });
    }
    psOutletAutocompleteList.style.display = 'block';
  }

  function selectPsOutlet(prog) {
    psOutletInput.value = prog.name;
    psOutletAutocompleteList.style.display = 'none';
    clearPsError('ps-outlet');

    // Populate Tên PS Select dropdown
    psNameSelect.innerHTML = '<option value="">-- Chọn Tên PS --</option>';
    if (prog.psNames && prog.psNames.length > 0) {
      prog.psNames.forEach(ps => {
        const opt = document.createElement('option');
        opt.value = ps;
        opt.textContent = ps;
        psNameSelect.appendChild(opt);
      });
      psNameSelect.disabled = false;
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Không có Tên PS nào được gán';
      psNameSelect.appendChild(opt);
      psNameSelect.disabled = true;
    }
  }

  if (psOutletInput) {
    psOutletInput.addEventListener('focus', () => {
      renderPsOutletAutocomplete(psOutletInput.value);
    });

    psOutletInput.addEventListener('input', () => {
      renderPsOutletAutocomplete(psOutletInput.value);
      if (psOutletInput.value.trim().length >= 1) {
        clearPsError('ps-outlet');
      }
    });

    psOutletInput.addEventListener('keydown', (e) => {
      const items = psOutletAutocompleteList.querySelectorAll('.autocomplete-item');
      if (psOutletAutocompleteList.style.display !== 'block' || items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activePsItemIndex = (activePsItemIndex + 1) % items.length;
        updatePsActiveAutocompleteRow(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activePsItemIndex = (activePsItemIndex - 1 + items.length) % items.length;
        updatePsActiveAutocompleteRow(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activePsItemIndex >= 0 && activePsItemIndex < items.length) {
          const index = parseInt(items[activePsItemIndex].dataset.index);
          const filteredForKey = samplePrograms.filter(prog => 
            prog.name.toLowerCase().includes(psOutletInput.value.toLowerCase()) &&
            prog.psNames &&
            prog.psNames.length > 0
          );
          const prog = filteredForKey[index];
          if (prog) selectPsOutlet(prog);
        }
      } else if (e.key === 'Escape') {
        psOutletAutocompleteList.style.display = 'none';
      }
    });
  }

  function updatePsActiveAutocompleteRow(items) {
    items.forEach((item, idx) => {
      if (idx === activePsItemIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (psOutletInput && !psOutletInput.contains(e.target) && !psOutletAutocompleteList.contains(e.target)) {
      if (psOutletAutocompleteList) psOutletAutocompleteList.style.display = 'none';
    }
  });

  // Error handling helpers
  function showPsError(fieldId, message) {
    const group = document.getElementById(`group-${fieldId}`);
    if (group) group.classList.add('has-error');
    const errEl = document.getElementById(`${fieldId}-error`);
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  }

  function clearPsError(fieldId) {
    const group = document.getElementById(`group-${fieldId}`);
    if (group) group.classList.remove('has-error');
    const errEl = document.getElementById(`${fieldId}-error`);
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  // Reset PS form to empty
  function resetPsFormState() {
    if (psForm) psForm.reset();
    if (psNameSelect) {
      psNameSelect.innerHTML = '<option value="">-- Chọn Tên PS (Vui lòng chọn Outlet trước) --</option>';
      psNameSelect.disabled = true;
    }
    psProductQuantities = {};
    if (psProductSearch) psProductSearch.value = '';
    renderPsProductGrid();
    setPsCurrentDate();
    
    // Clear validation error borders
    ['ps-outlet', 'ps-name', 'ps-promo', 'ps-ratio', 'ps-beer-cust', 'ps-competitor-cust'].forEach(f => clearPsError(f));
    const prodErr = document.getElementById('ps-products-error');
    if (prodErr) {
      prodErr.style.display = 'none';
      prodErr.textContent = '';
    }
  }

  // Reset Main form (Event/Display) to empty
  function resetMainFormState() {
    const mainFormEl = document.getElementById('activationForm');
    if (mainFormEl) mainFormEl.reset();
    
    // Clear checkboxes and radio style checked states
    document.querySelectorAll('.selector-card').forEach(card => {
      card.classList.remove('checked');
    });
    
    // Reset activityType radio UI state back to default (Event)
    const defaultEventRadio = document.getElementById('actEvent');
    if (defaultEventRadio) {
      defaultEventRadio.checked = true;
      const selectorCard = defaultEventRadio.closest('.selector-card');
      if (selectorCard) selectorCard.classList.add('checked');
      if (typeof handleActivityTypeChange === 'function') handleActivityTypeChange('Event');
    }

    currentStep = 1;
    if (typeof updateStepUI === 'function') updateStepUI();
    
    // Reset file manager state
    uploadedImagesDisplay1.length = 0;
    uploadedImagesDisplay2.length = 0;
    uploadedImagesDisplay3.length = 0;
    uploadedImages.length = 0;
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
    if (galleryError) {
      galleryError.style.display = 'none';
      galleryError.textContent = '';
    }
  }

  // Sanitize psRatioInput to only allow digits and slashes
  if (psRatioInput) {
    psRatioInput.addEventListener('input', () => {
      psRatioInput.value = psRatioInput.value.replace(/[^0-9/]/g, '');
    });
  }

  // PS Submit validation & submit handler
  if (btnPsSubmit) {
    btnPsSubmit.addEventListener('click', () => {
      clearPsError('ps-outlet');
      clearPsError('ps-name');
      clearPsError('ps-promo');
      clearPsError('ps-ratio');
      clearPsError('ps-beer-cust');
      clearPsError('ps-competitor-cust');
      const prodErr = document.getElementById('ps-products-error');
      if (prodErr) {
        prodErr.style.display = 'none';
        prodErr.textContent = '';
      }

      let isValid = true;

      // 1. Outlet validation
      const outletVal = psOutletInput.value.trim();
      const outletExists = samplePrograms.some(p => p.name === outletVal);
      if (!outletVal) {
        showPsError('ps-outlet', 'Vui lòng chọn hoặc nhập tên Outlet.');
        isValid = false;
      } else if (!outletExists) {
        showPsError('ps-outlet', 'Tên Outlet không hợp lệ (không tồn tại trong hệ thống).');
        isValid = false;
      }

      // 2. PS Name validation
      const psNameVal = psNameSelect.value;
      if (!psNameVal) {
        showPsError('ps-name', 'Vui lòng chọn tên PS.');
        isValid = false;
      }

      // 3. Promo validation
      const promoVal = psPromoInput.value.trim();
      if (!promoVal) {
        showPsError('ps-promo', 'Vui lòng nhập tên chương trình khuyến mãi.');
        isValid = false;
      }

      // 4. Ratio validation (Format: number/number)
      const ratioVal = psRatioInput.value.trim();
      const ratioRegex = /^\d+\/\d+$/;
      if (!ratioVal) {
        showPsError('ps-ratio', 'Vui lòng nhập tỉ lệ bàn rượu.');
        isValid = false;
      } else if (!ratioRegex.test(ratioVal)) {
        showPsError('ps-ratio', 'Tỉ lệ bàn không đúng định dạng. Ví dụ: 12/24.');
        isValid = false;
      }

      // 5. Beer Customers
      const beerCustVal = psBeerCustInput.value.trim();
      if (!beerCustVal) {
        showPsError('ps-beer-cust', 'Vui lòng nhập số khách.');
        isValid = false;
      } else if (parseInt(beerCustVal) < 0) {
        showPsError('ps-beer-cust', 'Số lượng không được âm.');
        isValid = false;
      }

      // 6. Competitor Customers
      const competitorCustVal = psCompetitorCustInput.value.trim();
      if (!competitorCustVal) {
        showPsError('ps-competitor-cust', 'Vui lòng nhập số khách.');
        isValid = false;
      } else if (parseInt(competitorCustVal) < 0) {
        showPsError('ps-competitor-cust', 'Số lượng không được âm.');
        isValid = false;
      }

      // 7. Products sold quantities check
      const salesData = {};
      let totalQty = 0;
      Object.keys(psProductQuantities).forEach(sku => {
        const qty = parseInt(psProductQuantities[sku]) || 0;
        if (qty > 0) {
          salesData[sku] = qty;
          totalQty += qty;
        }
      });

      if (totalQty === 0) {
        if (prodErr) {
          prodErr.textContent = 'Vui lòng nhập số lượng cho ít nhất 1 sản phẩm rượu công ty bán.';
          prodErr.style.display = 'block';
        }
        isValid = false;
      }

      if (!isValid) {
        showToast('Gửi thất bại', 'Vui lòng điền đầy đủ và chính xác các thông tin cần thiết.', 'error');
        return;
      }

      btnPsSubmit.disabled = true;
      btnPsSubmit.querySelector('.btn-text').textContent = 'Đang gửi báo cáo...';

      // Parse submitDate
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const reportDateStr = `${yyyy}-${mm}-${dd}`;

      const reportId = `rep_${Date.now()}`;
      const newPsReport = {
        id: reportId,
        activityType: 'PS',
        outletName: outletVal,
        psName: psNameVal,
        promoName: promoVal,
        tableRatio: ratioVal,
        beerCustCount: parseInt(beerCustVal),
        competitorCustCount: parseInt(competitorCustVal),
        companyProductSales: salesData,
        reportDate: reportDateStr,
        timestamp: today.toISOString()
      };

      const finishPsSubmit = () => {
        if (sumPsDate) sumPsDate.textContent = `Ngày báo cáo: ${dd}/${mm}/${yyyy}`;
        if (sumPsOutlet) sumPsOutlet.textContent = outletVal;
        if (sumPsName) sumPsName.textContent = psNameVal;
        if (sumPsPromo) sumPsPromo.textContent = promoVal;
        if (sumPsRatio) sumPsRatio.textContent = ratioVal;
        if (sumPsBeerCust) sumPsBeerCust.textContent = beerCustVal;
        if (sumPsCompetitorCust) sumPsCompetitorCust.textContent = competitorCustVal;
        
        if (sumPsProductsList) {
          sumPsProductsList.innerHTML = '';
          Object.keys(salesData).forEach(sku => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; font-size: 0.8rem; border-bottom: 1px dotted var(--border-glass); padding-bottom: 4px;';
            row.innerHTML = `
              <span style="color: var(--text-secondary);">${sku}</span>
              <span style="font-weight: 700; color: var(--text-primary);">${salesData[sku]} chai</span>
            `;
            sumPsProductsList.appendChild(row);
          });
        }

        if (psFormContainer) psFormContainer.style.display = 'none';
        if (psSuccessScreen) psSuccessScreen.style.display = 'block';
        
        btnPsSubmit.disabled = false;
        btnPsSubmit.querySelector('.btn-text').textContent = 'Gửi báo cáo số bán';
        showToast('Gửi thành công', 'Báo cáo số bán PS đã được lưu lại.', 'success');
        
        triggerConfetti();
      };

      if (useFirebase) {
        db.collection('reports').doc(reportId).set(newPsReport).then(() => {
          finishPsSubmit();
        }).catch(err => {
          console.error("Firestore save error:", err);
          btnPsSubmit.disabled = false;
          btnPsSubmit.querySelector('.btn-text').textContent = 'Gửi báo cáo số bán';
          showToast('Lỗi gửi báo cáo', 'Không thể lưu thông tin vào cơ sở dữ liệu đám mây.', 'error');
        });
      } else {
        reports.push(newPsReport);
        localStorage.setItem('diageo_reports', JSON.stringify(reports));
        renderReportsTable();
        finishPsSubmit();
      }
    });
  }

  // PS New Report reset & navigations
  if (btnPsNewReport) {
    btnPsNewReport.addEventListener('click', () => {
      resetPsFormState();
      if (psSuccessScreen) psSuccessScreen.style.display = 'none';
      if (psFormContainer) psFormContainer.style.display = 'block';
    });
  }

  if (btnPsSuccessBackToSelection) {
    btnPsSuccessBackToSelection.addEventListener('click', () => {
      resetPsFormState();
      window.history.pushState({}, '', '/');
      handleRouting();
    });
  }

  if (btnPsBackToLanding) {
    btnPsBackToLanding.addEventListener('click', () => {
      resetPsFormState();
      window.history.pushState({}, '', '/');
      handleRouting();
    });
  }

  // Simple Client-side routing based on Vercel deployment paths
  function handleRouting() {
    const path = window.location.pathname.toLowerCase();
    const appContainer = document.querySelector('.app-container');
    
    // Hide everything by default and reset width classes
    if (selectionScreen) selectionScreen.style.display = 'none';
    if (psComingSoonScreen) psComingSoonScreen.style.display = 'none';
    if (psFormContainer) psFormContainer.style.display = 'none';
    if (psSuccessScreen) psSuccessScreen.style.display = 'none';
    if (salesFormContainer) salesFormContainer.style.display = 'none';
    if (adminDashboard) adminDashboard.classList.remove('active');
    if (adminLoginModal) adminLoginModal.classList.remove('active');
    
    if (appContainer) {
      appContainer.classList.remove('selection-mode');
      appContainer.classList.remove('admin-mode');
    }
    document.body.classList.remove('admin-mode');
    
    if (path === '/admin' || path === '/admin/') {
      if (btnAdminTrigger) btnAdminTrigger.style.display = 'none';
      
      const isAdminAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
      if (isAdminAuthenticated) {
        if (adminDashboard) adminDashboard.classList.add('active');
        if (appContainer) appContainer.classList.add('admin-mode');
        document.body.classList.add('admin-mode');
        renderReportsTable();
        renderProgramCrudList();
      } else {
        if (adminLoginModal) adminLoginModal.classList.add('active');
        if (btnCloseLogin) btnCloseLogin.style.display = 'none';
        adminPasswordInput.value = '';
        adminPasswordInput.type = 'password';
        adminPasswordInput.focus();
        clearAdminLoginError();
      }
    } else if (path === '/event-activation' || path === '/event-activation/') {
      resetMainFormState();
      if (salesFormContainer) salesFormContainer.style.display = 'block';
      if (btnCloseLogin) btnCloseLogin.style.display = 'block';
      if (btnAdminTrigger) btnAdminTrigger.style.display = 'inline-flex';
    } else if (path === '/ps' || path === '/ps/') {
      resetPsFormState();
      if (psFormContainer) psFormContainer.style.display = 'block';
      if (btnAdminTrigger) btnAdminTrigger.style.display = 'inline-flex';
    } else {
      // Landing page selection
      if (selectionScreen) selectionScreen.style.display = 'block';
      if (btnAdminTrigger) btnAdminTrigger.style.display = 'none';
      if (appContainer) appContainer.classList.add('selection-mode');
    }
  }

  window.addEventListener('popstate', handleRouting);

  // Run initial state update
  updateStepUI();

  // Initialize data stores (after all DOM elements and helper functions are declared)
  initPrograms();
  initProducts();
  initReports();
  handleRouting();
});
