import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { apiFetch } from './api';
import {
  ARRL_VALID_SECTIONS,
  ARRL_CLASS_TOOLTIP,
  ARRL_CLASS_PLACEHOLDER,
  ARRL_CLASS_ERROR,
  validateClass,
  validateLocation,
  calculateQsoPoints,
  calculateScoreBreakdown,
  calculateProjectedScore,
  DEFAULT_STATION_SETTINGS
} from './fieldDayRules';
import Admin from './Admin';
import PublicDisplay from './PublicDisplay';
import ArrlSectionsMap from './ArrlSectionsMap';
import InfoTooltip from './InfoTooltip';
import { buildLicenseNotice } from './callsignLookup';
import ChangePasswordModal from './ChangePasswordModal';
import AboutPage from './AboutPage';
import AppFooter from './AppFooter';
import { BRAND_ASSETS, APP_NAME } from './branding';
import { useAuth } from './AuthContext';

const BAND_TOOLTIP = 'Bands: All Amateur bands may be used except 12, 17, 30, and 60 meters. To qualify as a band worked, at least one valid, two-way QSO must have taken place on the said band during the contest.';

const MODE_TOOLTIP = "Modes: All modes, CW, Phone, and Digital, may be used. Phone includes SSB, AM, FM, DMR, C4FM, etc. If the end result is voice, it's Phone. Digital includes PSK, RTTY, Olivia, Packet, SSTV, ATV, JS8Call, and other soundcard modes except for FT4 & FT8. If the end result is text or a picture, it's digital.";

const LOCATION_TOOLTIP = `ARRL Field Day Location (Section):

US stations: ARRL section (AZ, EMA, CT, etc.)
Canadian stations: RAC section (ONN, BC, QC, etc.)
Mexico: MX
All others: DX`;

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Cookie utility functions
const setCookie = (name, value, days = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

function App() {
  const { clubName, status, loggedInUser, logout } = useAuth();
  const location = useLocation();
  const isPublicDisplay = location.pathname === '/display';
  const isAboutPage = location.pathname === '/about';
  const [contacts, setContacts] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [formData, setFormData] = useState({
    callsign: '',
    name: '',
    frequency: getCookie('hamlog_frequency') || '',
    mode: getCookie('hamlog_mode') || '',
    classSent: '',
    locationReceived: '',
    callSignArea: '',
    notes: ''
  });

  const [operator, setOperator] = useState({
    callsign: getCookie('hamlog_operator_callsign') || '',
    name: getCookie('hamlog_operator_name') || ''
  });

  const [operatorModalData, setOperatorModalData] = useState({
    callsign: '',
    name: ''
  });

  const [lastActivity, setLastActivity] = useState(Date.now());
  const [operatorTimeout, setOperatorTimeout] = useState(null);
  const [lastInputChange, setLastInputChange] = useState('Never');

  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showCallsignPopup, setShowCallsignPopup] = useState(false);
  const [callsignPopupData, setCallsignPopupData] = useState(null);
  const [callsignPopupAnchor, setCallsignPopupAnchor] = useState({ x: 0, y: 0 });
  const [callsignPopupStyle, setCallsignPopupStyle] = useState({ left: 0, top: 0 });
  const [callsignPopupPlaced, setCallsignPopupPlaced] = useState(false);
  const callsignPopupRef = useRef(null);
  const repositionCallsignPopupRef = useRef(() => {});
  const [lastCallsign, setLastCallsign] = useState('');
  const [callsignCache, setCallsignCache] = useState({});
  const [licenseNotice, setLicenseNotice] = useState(null);
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContactData, setEditContactData] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapContainerId, setMapContainerId] = useState('callsign-map');
  const [activeOperators, setActiveOperators] = useState([]);

  const [showScorePopup, setShowScorePopup] = useState(false);
  const [stationSettings, setStationSettings] = useState(DEFAULT_STATION_SETTINGS);
  const [fieldErrors, setFieldErrors] = useState({});

  // ARRL Sections Map popup state
  const [showARRLMap, setShowARRLMap] = useState(false);

  

  const modes = ['CW', 'Phone', 'Digital'];
  
  const frequencyBands = [
    { value: '160', label: '160' },
    { value: '80', label: '80' },
    { value: '40', label: '40' },
    { value: '20', label: '20' },
    { value: '15', label: '15' },
    { value: '10', label: '10' },
    { value: '6', label: '6 (50 MHz)' },
    { value: '2', label: '2 (144 MHz)' },
    { value: '1.25', label: '1.25 (222 MHz)' },
    { value: '70cm', label: '70 cm (432 MHz)' },
    { value: '33cm', label: '33 cm (902 MHz)' },
    { value: '23cm', label: '23 cm (1.3 GHz)' },
    { value: '13cm', label: '13 cm (2.3 GHz)' },
    { value: '9cm', label: '9 cm (3.5 GHz)' },
    { value: '6cm', label: '6 cm (5.8 GHz)' },
    { value: '3cm', label: '3 cm (10 GHz)' },
    { value: 'satellite', label: 'Satellite' },
    { value: 'other', label: 'Other' }
  ];

  // Call Sign Area mapping based on ARRL section abbreviations
  const callSignAreaMap = {
    // Call Sign Area 1
    'CT': 'Connecticut',
    'EMA': 'Eastern Massachusetts',
    'ME': 'Maine',
    'NH': 'New Hampshire',
    'RI': 'Rhode Island',
    'VT': 'Vermont',
    'WMA': 'Western Massachusetts',
    // Call Sign Area 2
    'ENY': 'Eastern New York',
    'NLI': 'New York City - Long Island',
    'NNJ': 'Northern New Jersey',
    'NNY': 'Northern New York',
    'SNJ': 'Southern New Jersey',
    'WNY': 'Western New York',
    // Call Sign Area 3
    'DE': 'Delaware',
    'EPA': 'Eastern Pennsylvania',
    'MDC': 'Maryland-DC',
    'WPA': 'Western Pennsylvania',
    // Call Sign Area 4
    'AL': 'Alabama',
    'GA': 'Georgia',
    'KY': 'Kentucky',
    'NC': 'North Carolina',
    'NFL': 'Northern Florida',
    'PR': 'Puerto Rico',
    'SC': 'South Carolina',
    'SFL': 'Southern Florida',
    'TN': 'Tennessee',
    'VA': 'Virginia',
    'VI': 'Virgin Islands',
    'WCF': 'West Central Florida',
    // Call Sign Area 5
    'AR': 'Arkansas',
    'LA': 'Louisiana',
    'MS': 'Mississippi',
    'NM': 'New Mexico',
    'NTX': 'North Texas',
    'OK': 'Oklahoma',
    'STX': 'South Texas',
    'WTX': 'West Texas',
    // Call Sign Area 6
    'EB': 'East Bay',
    'LAX': 'Los Angeles',
    'ORG': 'Orange',
    'PAC': 'Pacific',
    'SB': 'Santa Barbara',
    'SCV': 'Santa Clara Valley',
    'SDG': 'San Diego',
    'SF': 'San Francisco',
    'SJV': 'San Joaquin Valley',
    'SV': 'Sacramento Valley',
    // Call Sign Area 7
    'AK': 'Alaska',
    'AZ': 'Arizona',
    'EWA': 'Eastern Washington',
    'ID': 'Idaho',
    'MT': 'Montana',
    'NV': 'Nevada',
    'OR': 'Oregon',
    'UT': 'Utah',
    'WWA': 'Western Washington',
    'WY': 'Wyoming',
    // Call Sign Area 8
    'MI': 'Michigan',
    'OH': 'Ohio',
    'WV': 'West Virginia',
    // Call Sign Area 9
    'IL': 'Illinois',
    'IN': 'Indiana',
    'WI': 'Wisconsin',
    // Call Sign Area 0
    'CO': 'Colorado',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'MN': 'Minnesota',
    'MO': 'Missouri',
    'ND': 'North Dakota',
    'NE': 'Nebraska',
    'SD': 'South Dakota',
    // Canadian Sections
    'AB': 'Alberta',
    'BC': 'British Columbia',
    'GH': 'Golden Horseshoe',
    'MB': 'Manitoba',
    'NB': 'New Brunswick',
    'NL': 'Newfoundland/Labrador',
    'NS': 'Nova Scotia',
    'ONE': 'Ontario East',
    'ONN': 'Ontario North',
    'ONS': 'Ontario South',
    'PE': 'Prince Edward Island',
    'QC': 'Quebec',
    'SK': 'Saskatchewan',
    'TER': 'Territories',
    // Special locations
    'MX': 'Mexico',
    'DX': 'DX'
  };

  // Calculate QSO points based on ARRL Field Day rules (Phone ×1, CW/Digital ×2)

  const getContactOperator = (contact) => contact?.operator || contact?.createdBy || null;

  // Calculate individual operator scores
  const calculateOperatorScores = (contacts) => {
    const operatorScores = {};
    
    contacts.forEach(contact => {
      const contactOperator = getContactOperator(contact);
      if (contactOperator) {
        if (!operatorScores[contactOperator]) {
          operatorScores[contactOperator] = {
            total: 0,
            phone: 0,
            cw: 0,
            digital: 0,
            contacts: 0,
            uniqueSections: new Set()
          };
        }
        
        operatorScores[contactOperator].contacts++;
        operatorScores[contactOperator].uniqueSections.add(contact.locationReceived.toUpperCase());
        
        if (contact.mode === 'Phone') {
          operatorScores[contactOperator].phone++;
          operatorScores[contactOperator].total += 1;
        } else if (contact.mode === 'CW') {
          operatorScores[contactOperator].cw++;
          operatorScores[contactOperator].total += 2;
        } else if (contact.mode === 'Digital') {
          operatorScores[contactOperator].digital++;
          operatorScores[contactOperator].total += 2;
        }
      }
    });
    
    // Convert Sets to counts for display
    const result = {};
    Object.entries(operatorScores).forEach(([operator, scores]) => {
      result[operator] = {
        ...scores,
        uniqueSections: scores.uniqueSections.size
      };
    });
    
    return result;
  };


  // Check if contact is duplicate (callsign + band + mode)
  const isDuplicateContact = (callsign, frequency, mode) => {
    return contacts.some(contact => 
      contact.callsign.toUpperCase() === callsign.toUpperCase() &&
      contact.frequency === frequency &&
      contact.mode === mode
    );
  };

  // Check if current form data would be a duplicate
  const isCurrentFormDuplicate = () => {
    if (!formData.callsign || !formData.frequency || !formData.mode) return false;
    return isDuplicateContact(formData.callsign, formData.frequency, formData.mode);
  };

  // Check if band/mode combination is already in use by another operator
  const isBandModeInUse = (frequency, mode, excludeCallsign = '') => {
    return activeOperators.some(op => 
      op.frequency === frequency && 
      op.mode === mode && 
      op.callsign !== excludeCallsign
    );
  };

  // Get the operator currently using a band/mode combination
  const getOperatorUsingBandMode = (frequency, mode) => {
    return activeOperators.find(op => 
      op.frequency === frequency && 
      op.mode === mode
    );
  };

  // Lookup call sign area from location
  const lookupCallSignArea = useCallback((location) => {
    if (!location) {
      setFormData(prev => ({ ...prev, callSignArea: '' }));
      return;
    }
    
    const upperLocation = location.toUpperCase();
    const areaName = callSignAreaMap[upperLocation];
    
    if (areaName) {
      setFormData(prev => ({ ...prev, callSignArea: areaName }));
    } else {
      setFormData(prev => ({ ...prev, callSignArea: '' }));
    }
  }, [callSignAreaMap]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`handleInputChange called: ${name} = ${value}`);
    setLastInputChange(new Date().toLocaleTimeString());
    
    // Clear name when callsign is cleared
    if (name === 'callsign' && !value) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        name: ''
      }));
      return;
    }
    
    // Clear call sign area when location is cleared
    if (name === 'locationReceived' && !value) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        callSignArea: ''
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Immediately update active operator if band or mode changes
    if ((name === 'frequency' || name === 'mode') && operator.callsign) {
      const newFrequency = name === 'frequency' ? value : formData.frequency;
      const newMode = name === 'mode' ? value : formData.mode;
      
      const currentOperator = activeOperators.find(op => op.callsign === operator.callsign);
      if (currentOperator) {
        // Check if band or mode actually changed
        const bandModeChanged = currentOperator.frequency !== newFrequency || currentOperator.mode !== newMode;
        
        const updatedOperator = {
          ...currentOperator,
          frequency: newFrequency,
          mode: newMode,
          timestamp: new Date().toISOString(),
          bandModeTimestamp: bandModeChanged ? new Date().toISOString() : currentOperator.bandModeTimestamp
        };
        
        // Update in database - server will handle duplicate flag calculation
        console.log(`Updating operator ${operator.callsign} to ${newFrequency} ${newMode} in database`);
        console.log('Updated operator data:', updatedOperator);
        updateActiveOperator(updatedOperator);
      }
    }
  };

  // Callsign lookup function
  const cacheCallsignLookup = useCallback((upperCallsign, data) => {
    setCallsignCache((prev) => ({
      ...prev,
      [upperCallsign]: data
    }));
  }, []);

  const lookupCallsign = async (callsign) => {
    if (!callsign || callsign.length < 3) {
      setFormData(prev => ({ ...prev, name: '' }));
      setLicenseNotice(null);
      return;
    }

    const upperCallsign = callsign.toUpperCase();
    
    // Check cache first
    if (callsignCache[upperCallsign]) {
      const cached = callsignCache[upperCallsign];
      setFormData(prev => ({ ...prev, name: cached.name || '' }));
      setLicenseNotice(buildLicenseNotice(cached, upperCallsign));
      return;
    }

    try {
      const response = await apiFetch(`/api/lookup/${upperCallsign}`);
      const data = await response.json();
      
      if (data.success) {
        cacheCallsignLookup(upperCallsign, data);
        setFormData(prev => ({ ...prev, name: data.name || '' }));
        setLicenseNotice(buildLicenseNotice(data, upperCallsign));
      } else {
        setFormData(prev => ({ ...prev, name: '' }));
        setLicenseNotice(null);
      }
    } catch (error) {
      console.error('Error looking up callsign:', error);
      setFormData(prev => ({ ...prev, name: '' }));
    }
  };

    const showCallsignDetails = async (callsign, event) => {
    if (!callsign) return;

    const upperCallsign = callsign.toUpperCase();
    const anchor = { x: event.clientX, y: event.clientY };
    setCallsignPopupAnchor(anchor);

    // Check cache first
    if (callsignCache[upperCallsign]) {
      console.log('Using cached data for callsign:', upperCallsign);
      const cachedData = callsignCache[upperCallsign];
      setCallsignPopupData(cachedData);
      setShowCallsignPopup(true);
      setLastCallsign(upperCallsign);
      
      // Initialize map for cached data
      if (cachedData.grid) {
        console.log('Initializing map for cached data with grid:', cachedData.grid);
        setTimeout(() => {
          console.log('Calling initializeMap from cached data setTimeout');
          initializeMap(cachedData.grid);
        }, 100);
      } else {
        console.log('No grid data in cached data');
      }
      return;
    }

    // Prevent duplicate calls for the same callsign
    if (upperCallsign === lastCallsign && showCallsignPopup) {
      return;
    }

    setLastCallsign(upperCallsign);

    try {
      const response = await apiFetch(`/api/lookup/${upperCallsign}`);
      const data = await response.json();

      if (data.success) {
        console.log('Callsign lookup response:', data);
        
        // Add lat/lon if grid is available
        if (data.grid) {
          const coords = gridToLocation(data.grid);
          if (coords) {
            data.lat = coords.lat;
            data.lon = coords.lon;
          }
        }
        
        // Cache the data
        cacheCallsignLookup(upperCallsign, data);
        
        setCallsignPopupData(data);
        setShowCallsignPopup(true);
        
        console.log('Set callsign popup data:', data);
        
        // Initialize map after popup is shown
        if (data.grid) {
          console.log('About to initialize map with grid:', data.grid);
          setTimeout(() => {
            console.log('Calling initializeMap from setTimeout');
            initializeMap(data.grid);
          }, 100);
        } else {
          console.log('No grid data available for map initialization');
        }
      }
    } catch (error) {
      console.error('Error looking up callsign details:', error);
    }
  };

  const updateCallsignPopupPosition = useCallback(() => {
    const popup = callsignPopupRef.current;
    if (!popup) return;

    const margin = 12;
    const offsetX = 15;
    const offsetY = 10;
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const { x, y } = callsignPopupAnchor;

    let left = x + offsetX;
    let top = y - offsetY;

    if (left + popupRect.width > viewportWidth - margin) {
      left = x - popupRect.width - offsetX;
    }
    if (left < margin) {
      left = margin;
    }

    if (top + popupRect.height > viewportHeight - margin) {
      top = y - popupRect.height - offsetY;
    }
    if (top < margin) {
      top = margin;
    }

    setCallsignPopupStyle({ left, top });
    setCallsignPopupPlaced(true);
  }, [callsignPopupAnchor]);

  useLayoutEffect(() => {
    repositionCallsignPopupRef.current = updateCallsignPopupPosition;
  }, [updateCallsignPopupPosition]);

  useLayoutEffect(() => {
    if (!showCallsignPopup) {
      setCallsignPopupPlaced(false);
      return undefined;
    }

    const reposition = () => updateCallsignPopupPosition();

    reposition();
    const frame = requestAnimationFrame(reposition);
    const afterMapFrame = window.setTimeout(reposition, 350);

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(afterMapFrame);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [showCallsignPopup, callsignPopupAnchor, callsignPopupData, mapContainerId, updateCallsignPopupPosition]);

  // Grid square to location conversion (client-side version)
  const gridToLocation = (gridSquare) => {
    if (!gridSquare || gridSquare.length < 4) return null;

    const grid = gridSquare.toUpperCase();
    
    // Extract grid components
    const field1 = grid.charCodeAt(0) - 65; // A=0, B=1, etc.
    const field2 = grid.charCodeAt(1) - 65;
    const square1 = parseInt(grid.charAt(2));
    const square2 = parseInt(grid.charAt(3));
    
    // Calculate latitude and longitude
    let lon = (field1 * 20) + (square1 * 2) - 180;
    let lat = (field2 * 10) + square2 - 90;
    
    // Add subsquare precision if available
    if (grid.length >= 6) {
      const subsquare1 = grid.charCodeAt(4) - 65;
      const subsquare2 = grid.charCodeAt(5) - 65;
      lon += (subsquare1 * 5 / 60);
      lat += (subsquare2 * 2.5 / 60);
    }
    
    return { lat, lon };
  };

  // Add a ref to track map initialization state
  const mapInitializingRef = useRef(false);
  const mapTimeoutRef = useRef(null);

  const initializeMap = (gridSquare) => {
    console.log('initializeMap called with gridSquare:', gridSquare);
    
    // Prevent multiple simultaneous initializations
    if (mapInitializingRef.current) {
      console.log('Map initialization already in progress, skipping');
      return;
    }
    
    // Clear any existing timeout
    if (mapTimeoutRef.current) {
      clearTimeout(mapTimeoutRef.current);
    }
    
    // Convert grid square to coordinates first
    const coords = gridToLocation(gridSquare);
    console.log('Grid to location conversion:', { gridSquare, coords });
    if (!coords) {
      console.error('Failed to convert grid square to coordinates');
      return;
    }
    
    // Remove existing map instance if it exists
    if (mapInstance) {
      try {
        mapInstance.remove();
        console.log('Removed existing map instance');
      } catch (error) {
        console.log('Map already removed');
      }
      setMapInstance(null);
    }
    
    // Generate unique container ID
    const uniqueId = `callsign-map-${Date.now()}`;
    setMapContainerId(uniqueId);
    console.log('Generated map container ID:', uniqueId);
    
    // Set initialization flag
    mapInitializingRef.current = true;
    
    // Use a longer timeout to ensure DOM is ready and previous map is cleaned up
    mapTimeoutRef.current = setTimeout(() => {
      try {
        console.log('Attempting to initialize map...');
        
        // Get the container with the new ID
        const mapContainer = document.getElementById(uniqueId);
        console.log('Map container found:', mapContainer);
        if (!mapContainer) {
          console.error('Map container not found with ID:', uniqueId);
          mapInitializingRef.current = false;
          return;
        }
        
        // Check if Leaflet is available
        if (typeof L === 'undefined') {
          console.error('Leaflet is not loaded');
          mapInitializingRef.current = false;
          return;
        }
        
        // Check if container already has a map
        if (mapContainer._leaflet_id) {
          console.log('Container already has a map, removing it first');
          try {
            // eslint-disable-next-line no-undef
            L.DomUtil.remove(mapContainer);
          } catch (error) {
            console.log('Error removing existing map from container:', error);
          }
        }
        
        console.log('Creating map with coordinates:', coords);
        
        // Create new map
        // eslint-disable-next-line no-undef
        const map = L.map(uniqueId).setView([coords.lat, coords.lon], 6);
        
        // Store map instance
        setMapInstance(map);
        console.log('Map instance created and stored');
        
        // Add OpenStreetMap tiles
        // eslint-disable-next-line no-undef
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add marker for grid square location
        // eslint-disable-next-line no-undef
        L.marker([coords.lat, coords.lon]).addTo(map)
          .bindPopup(`Grid: ${gridSquare}<br>Location: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`);
        
        console.log('Map initialization completed successfully');
        requestAnimationFrame(() => repositionCallsignPopupRef.current());
      } catch (error) {
        console.error('Error initializing map:', error);
      } finally {
        // Reset initialization flag
        mapInitializingRef.current = false;
      }
    }, 300); // Increased timeout to 300ms
  };



  // Debounced callsign lookup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.callsign) {
        lookupCallsign(formData.callsign);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.callsign]);

  // Debounced call sign area lookup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.locationReceived) {
        lookupCallSignArea(formData.locationReceived);
      }
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.locationReceived, lookupCallSignArea]);

  // Cleanup map timeouts on unmount
  useEffect(() => {
    return () => {
      if (mapTimeoutRef.current) {
        clearTimeout(mapTimeoutRef.current);
      }
    };
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format current date
  const formatCurrentDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format current time (local and UTC)
  const formatCurrentTime = () => {
    const localTime = currentTime.toLocaleTimeString('en-US', {
      hour12: true, // Use AM/PM
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const utcTime = currentTime.toUTCString().split(' ')[4];
    return `${localTime} / ${utcTime} UTC`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    
    // Validate operator is set
    if (!operator.callsign) {
      alert('Please set an operator before logging contacts.');
      setShowOperatorModal(true);
      return;
    }
    
    // Validate band and mode are selected
    if (!formData.frequency || !formData.mode) {
      alert('Please select both band and mode before logging contacts.');
      return;
    }

    const nextFieldErrors = {};
    if (!formData.callsign?.trim()) {
      nextFieldErrors.callsign = 'required';
    }
    if (!formData.classSent?.trim()) {
      nextFieldErrors.classSent = 'required';
    }
    if (!formData.locationReceived?.trim()) {
      nextFieldErrors.locationReceived = 'required';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    
    console.log('Original form data:', formData);
    
    // Ensure all text fields are uppercase
    const upperFormData = {
      ...formData,
      callsign: formData.callsign.toUpperCase(),
      classSent: formData.classSent.toUpperCase(),
      locationReceived: formData.locationReceived.toUpperCase()
    };
    
    console.log('Uppercase form data:', upperFormData);
    
    // Validate class
    if (!validateClass(upperFormData.classSent)) {
      setFieldErrors({ classSent: 'invalid' });
      return;
    }
    
    // Validate location
    if (!validateLocation(upperFormData.locationReceived)) {
      setFieldErrors({ locationReceived: 'invalid' });
      return;
    }
    
    // Check for duplicate contact
    if (isDuplicateContact(upperFormData.callsign, upperFormData.frequency, upperFormData.mode)) {
      alert(`Duplicate contact! You've already logged ${upperFormData.callsign} on ${upperFormData.frequency} ${upperFormData.mode}`);
      return;
    }
    
    const newContact = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...upperFormData,
      operator: operator.callsign
    };

    console.log('New contact to submit:', newContact);

    try {
      const response = await apiFetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContact),
      });

      if (response.ok) {
        const savedContact = await response.json();
        setContacts(prev => [savedContact, ...prev]);
        
        // Clear only callsign, name, class, location, callSignArea, and notes - keep band and mode
        setFormData(prev => ({
          ...prev,
          callsign: '',
          name: '',
          classSent: '',
          locationReceived: '',
          callSignArea: '',
          notes: ''
        }));
        setLicenseNotice(null);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      // For demo purposes, add to local state even if server fails
      setContacts(prev => [newContact, ...prev]);
      setFormData(prev => ({
        ...prev,
        callsign: '',
        name: '',
        classSent: '',
        locationReceived: '',
        callSignArea: '',
        notes: ''
      }));
      setLicenseNotice(null);
    }
  };

  // Function to format time in UTC
  const formatUTCTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
  };

  // Load contacts from server on component mount and set up polling
  // This ensures real-time updates when other operators add contacts
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await apiFetch('/api/contacts');
        if (response.ok) {
          const data = await response.json();
          setContacts(data);
        }
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    };

    const loadStationSettings = async () => {
      try {
        const response = await apiFetch('/api/station-settings');
        if (response.ok) {
          setStationSettings(await response.json());
        }
      } catch (error) {
        console.error('Error loading station settings:', error);
      }
    };

    loadContacts();
    loadStationSettings();

    const pollInterval = setInterval(() => {
      loadContacts();
      loadStationSettings();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const qsoPoints = calculateQsoPoints(contacts);
  const scoreBreakdown = calculateScoreBreakdown(contacts);
  const projectedScore = calculateProjectedScore(qsoPoints, stationSettings);
  const hasStationConfig = Boolean(stationSettings.entryClass);
  const operatorScores = calculateOperatorScores(contacts);
  const isLocationInvalid = Boolean(fieldErrors.locationReceived === 'invalid'
    || (formData.locationReceived && !validateLocation(formData.locationReceived)));
  const isClassInvalid = Boolean(fieldErrors.classSent === 'invalid'
    || (formData.classSent && !validateClass(formData.classSent)));
  const isLocationMissing = fieldErrors.locationReceived === 'required';
  const isClassMissing = fieldErrors.classSent === 'required';
  // Check if current band/mode combination has multiple operators (conflict)
  const operatorsWithSameBandMode = activeOperators.filter(op => 
    op.frequency === formData.frequency && op.mode === formData.mode
  );
  const isBandModeConflict = operator.callsign && formData.frequency && formData.mode && 
    operatorsWithSameBandMode.length > 1;
  
  // Debug conflict detection
  if (operator.callsign && formData.frequency && formData.mode) {
    console.log(`Conflict check for ${operator.callsign} on ${formData.frequency} ${formData.mode}:`, {
      operatorsWithSameBandMode: operatorsWithSameBandMode.length,
      operators: operatorsWithSameBandMode.map(op => op.callsign),
      isBandModeConflict,
      allActiveOperators: activeOperators.map(op => ({
        callsign: op.callsign,
        frequency: op.frequency,
        mode: op.mode,
        duplicateUser: op.duplicateUser
      }))
    });
  }
  const isDuplicateEntry = isCurrentFormDuplicate();

  // Function to get the operator who should be highlighted for a band/mode conflict
  const getHighlightedOperator = (frequency, mode) => {
    if (!frequency || !mode) return null;
    
    const operatorsWithBandMode = activeOperators.filter(op => 
      op.frequency === frequency && op.mode === mode
    );
    
    if (operatorsWithBandMode.length === 0) return null;
    
    // Sort by bandModeTimestamp to find the first operator who chose this band/mode
    return operatorsWithBandMode.sort((a, b) => 
      new Date(a.bandModeTimestamp || a.timestamp) - new Date(b.bandModeTimestamp || b.timestamp)
    )[0];
  };

  // Function to format timestamp for display
  const formatOperatorTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Function to get operators using the same band/mode and format their names
  const getOperatorsUsingBandMode = (frequency, mode, excludeCallsign = '') => {
    if (!frequency || !mode) return [];
    
    return activeOperators
      .filter(op => 
        op.frequency === frequency && 
        op.mode === mode && 
        op.callsign !== excludeCallsign
      )
      .map(op => ({
        callsign: op.callsign,
        name: op.name || 'Unknown'
      }));
  };

  // Function to format operator names for display
  const formatOperatorNames = (operators) => {
    if (operators.length === 0) return '';
    if (operators.length === 1) {
      return `${operators[0].callsign} (${operators[0].name})`;
    }
    
    const formattedNames = operators.map(op => `${op.callsign} (${op.name})`);
    const lastOperator = formattedNames.pop();
    return `${formattedNames.join(', ')} and ${lastOperator}`;
  };

  // Group contacts by call sign area
  const sectionsByArea = {
    'DX': ['DX', 'MX'],
    '1': ['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA'],
    '2': ['ENY', 'NLI', 'NNJ', 'NNY', 'SNJ', 'WNY'],
    '3': ['DE', 'EPA', 'MDC', 'WPA'],
    '4': ['AL', 'GA', 'KY', 'NC', 'NFL', 'PR', 'SC', 'SFL', 'TN', 'VA', 'VI', 'WCF'],
    '5': ['AR', 'LA', 'MS', 'NM', 'NTX', 'OK', 'STX', 'WTX'],
    '6': ['EB', 'LAX', 'ORG', 'PAC', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV'],
    '7': ['AK', 'AZ', 'EWA', 'ID', 'MT', 'NV', 'OR', 'UT', 'WWA', 'WY'],
    '8': ['MI', 'OH', 'WV'],
    '9': ['IL', 'IN', 'WI'],
    '0': ['CO', 'IA', 'KS', 'MN', 'MO', 'ND', 'NE', 'SD'],
    'Canada': ['AB', 'BC', 'GH', 'MB', 'NB', 'NL', 'NS', 'ONE', 'ONN', 'ONS', 'PE', 'QC', 'SK', 'TER']
  };

  const getAreaLabel = (area) => {
    if (area === 'DX') return 'DX / Mexico';
    if (area === 'Canada') return 'Canada';
    if (/^\d$/.test(area)) return `Call Area ${area}`;
    return area;
  };

  // Check if all sections in a specific area are contacted
  const isAreaComplete = (areaSections) => {
    console.log('Checking area completion for sections:', areaSections);
    console.log('Current contacts:', contacts.map(c => c.locationReceived));
    const result = areaSections.every(section => {
      const hasContact = contacts.some(contact => 
        contact.locationReceived.toUpperCase() === section.toUpperCase()
      );
      console.log(`Section ${section}: ${hasContact ? 'CONTACTED' : 'NOT CONTACTED'}`);
      return hasContact;
    });
    console.log('Area complete result:', result);
    return result;
  };

  // Get the area for a specific section
  const getSectionArea = (section) => {
    if (!section) return null;
    
    console.log(`Looking for area for section: ${section}`);
    for (const [area, sections] of Object.entries(sectionsByArea)) {
      console.log(`Checking area ${area}:`, sections);
      if (sections.includes(section.toUpperCase())) {
        console.log(`Found section ${section} in area ${area}`);
        return area;
      }
    }
    console.log(`Section ${section} not found in any area`);
    return null;
  };

  // Generate popup content for ARRL sections
  const getSectionFullName = (section) => {
    return callSignAreaMap[section?.toUpperCase()] || section;
  };

  const buildSectionPopupElement = (section) => {
    const sectionContacts = contacts.filter((contact) =>
      contact.deleted !== 'Y'
      && contact.locationReceived?.toUpperCase() === section.toUpperCase()
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const popup = document.createElement('div');
    popup.className = 'floating-popup section-hover-popup';

    const title = document.createElement('div');
    title.className = 'section-popup-title';
    title.textContent = getSectionFullName(section);
    popup.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'section-popup-summary';
    if (sectionContacts.length === 0) {
      summary.textContent = `${section} - No contacts logged`;
      popup.appendChild(summary);
      return popup;
    }

    summary.textContent = `${section} - ${sectionContacts.length} contact(s):`;
    popup.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'section-popup-list';
    const limitedContacts = sectionContacts.slice(0, 10);
    limitedContacts.forEach((contact) => {
      const row = document.createElement('div');
      row.className = 'section-popup-row';
      row.textContent = `${contact.callsign} - ${contact.frequency} ${contact.mode}`;
      list.appendChild(row);
    });

    if (sectionContacts.length > 10) {
      const more = document.createElement('div');
      more.className = 'section-popup-more';
      more.textContent = `(Showing first 10 of ${sectionContacts.length})`;
      list.appendChild(more);
    }

    popup.appendChild(list);
    return popup;
  };

  // Handle mouse enter for popup positioning
  const handleSectionMouseEnter = (e, section) => {
    // Prevent creating multiple popups
    if (e.target._popup) {
      return;
    }

    const popup = buildSectionPopupElement(section);
    popup.style.position = 'fixed';
    popup.style.zIndex = '9999';
    popup.style.pointerEvents = 'none';
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = mouseX + 15;
    let y = mouseY - 10;

    document.body.appendChild(popup);
    
    const popupRect = popup.getBoundingClientRect();
    const actualPopupWidth = popupRect.width;
    const actualPopupHeight = popupRect.height;

    if (x + actualPopupWidth > viewportWidth - 20) {
      x = mouseX - actualPopupWidth - 15;
    }

    if (y + actualPopupHeight > viewportHeight - 20) {
      y = mouseY - actualPopupHeight - 10;
    }

    if (y < 10) {
      y = 10;
    }
    
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    
    e.target._popup = popup;
  };

  // Handle mouse leave to remove popup
  const handleSectionMouseLeave = (e) => {
    if (e.target._popup) {
      document.body.removeChild(e.target._popup);
      delete e.target._popup;
    }
  };

  const handleOperatorChange = (e) => {
    const { name, value } = e.target;
    const upperValue = name === 'callsign' ? value.toUpperCase() : value;
    
    setOperatorModalData(prev => ({
      ...prev,
      [name]: upperValue
    }));

    // If callsign is being changed, clear the name and trigger lookup
    if (name === 'callsign') {
      setOperatorModalData(prev => ({
        ...prev,
        callsign: upperValue,
        name: upperValue ? prev.name : ''
      }));
      
      // Trigger callsign lookup
      if (upperValue && upperValue.length >= 3) {
        lookupOperatorCallsign(upperValue);
      }
    }
  };

  const lookupOperatorCallsign = async (callsign) => {
    if (!callsign || callsign.length < 3) {
      setOperatorModalData(prev => ({ ...prev, name: '' }));
      setLicenseNotice(null);
      return;
    }

    const upperCallsign = callsign.toUpperCase();
    
    // Check cache first
    if (callsignCache[upperCallsign]) {
      const cached = callsignCache[upperCallsign];
      setOperatorModalData(prev => ({ ...prev, name: cached.name || '' }));
      return;
    }

    try {
      const response = await apiFetch(`/api/lookup/${upperCallsign}`);
      const data = await response.json();
      
      if (data.success) {
        cacheCallsignLookup(upperCallsign, data);
        setOperatorModalData(prev => ({ ...prev, name: data.name || '' }));
      } else {
        setOperatorModalData(prev => ({ ...prev, name: '' }));
      }
    } catch (error) {
      console.error('Error looking up operator callsign:', error);
      setOperatorModalData(prev => ({ ...prev, name: '' }));
    }
  };

  const handleOperatorSubmit = (e) => {
    e.preventDefault();
    
    setOperator(operatorModalData);
    setShowOperatorModal(false);
    
    // Add operator to active operators list in database
    const newOperator = {
      callsign: operatorModalData.callsign,
      name: operatorModalData.name,
      frequency: formData.frequency,
      mode: formData.mode,
      timestamp: new Date().toISOString(),
      bandModeTimestamp: new Date().toISOString(), // Separate timestamp for band/mode changes
      duplicateUser: 'N' // Will be calculated by server
    };
    
    // Add to database - server will handle duplicate flag calculation
    addActiveOperator(newOperator);
  };

  const addActiveOperator = async (operatorData) => {
    try {
      console.log('Adding active operator:', operatorData);
      const response = await apiFetch('/api/active-operators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(operatorData)
      });
      
      if (response.ok) {
        console.log('Successfully added operator to database - polling will update UI');
      } else {
        console.error('Failed to add operator to database:', response.status);
      }
    } catch (error) {
      console.error('Error adding active operator:', error);
    }
  };

  const removeActiveOperator = async (callsign) => {
    try {
      const response = await apiFetch(`/api/active-operators/${callsign}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('Successfully removed operator from database - polling will update UI');
      }
    } catch (error) {
      console.error('Error removing active operator:', error);
    }
  };

  const loadActiveOperators = async () => {
    try {
      const response = await apiFetch('/api/active-operators');
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded active operators from server:', data);
        console.log('Active operators with duplicate flags:', data.map(op => ({
          callsign: op.callsign,
          frequency: op.frequency,
          mode: op.mode,
          duplicateUser: op.duplicateUser,
          timestamp: op.timestamp,
          bandModeTimestamp: op.bandModeTimestamp
        })));
        
        // Always update from server data - polling drives everything
        setActiveOperators(data);
        console.log('Updated activeOperators state with', data.length, 'operators');
        
        // Check for conflicts after update
        const conflicts = data.filter(op => op.duplicateUser === 'Y');
        if (conflicts.length > 0) {
          console.log('Found operators with conflicts:', conflicts.map(op => op.callsign));
        } else {
          console.log('No operators with conflicts found');
        }
      } else {
        console.error('Failed to load active operators:', response.status);
      }
    } catch (error) {
      console.error('Error loading active operators:', error);
    }
  };

  const handleOpenOperatorModal = () => {
    setOperatorModalData(operator);
    setShowOperatorModal(true);
  };

  const handleOperatorLogout = async () => {
    const callsignToRemove = (operator.callsign || status.userCallsign || '').trim().toUpperCase();

    if (loggedInUser) {
      await logout(callsignToRemove || undefined);
      return;
    }

    if (callsignToRemove) {
      await removeActiveOperator(callsignToRemove);
    }

    setOperator({ callsign: '', name: '' });
    setOperatorModalData({ callsign: '', name: '' });
  };

  // Track user activity
  const updateActivity = () => {
    setLastActivity(Date.now());
  };

  // Sync operator from user account login
  useEffect(() => {
    if (!loggedInUser || !status.userCallsign) {
      return;
    }

    setOperator((prev) => {
      if (prev.callsign === status.userCallsign) {
        return prev;
      }
      return { callsign: status.userCallsign, name: prev.name || '' };
    });
  }, [loggedInUser, status.userCallsign]);

  // Auto-logout operator after 60 minutes of inactivity
  useEffect(() => {
    if (operator.callsign) {
      const checkInactivity = () => {
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivity;
        const sixtyMinutes = 60 * 60 * 1000; // 60 minutes in milliseconds

        if (timeSinceLastActivity >= sixtyMinutes) {
          const inactiveCallsign = operator.callsign;
          if (inactiveCallsign) {
            removeActiveOperator(inactiveCallsign);
          }
          setOperator({ callsign: '', name: '' });
          setOperatorModalData({ callsign: '', name: '' });
          alert('Operator logged out due to 60 minutes of inactivity.');
        }
      };

      const interval = setInterval(checkInactivity, 60000); // Check every minute
      setOperatorTimeout(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [operator.callsign, lastActivity]);

  // Clear timeout when component unmounts
  useEffect(() => {
    return () => {
      if (operatorTimeout) clearInterval(operatorTimeout);
    };
  }, [operatorTimeout]);

    // Add activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const handleActivity = () => {
      updateActivity();
      // Also update operator timestamp if operator is set
      if (operator.callsign) {
        updateOperatorHeartbeat();
      }
    };

    // Handle ESC key to clear log data
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        // Clear user-entered log data but preserve band and mode
        setFormData(prev => ({
          ...prev,
          callsign: '',
          locationReceived: '',
          notes: ''
        }));
        setCallsignPopupData(null);
        setShowCallsignPopup(false);
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Add ESC key listener
    document.addEventListener('keydown', handleEscKey);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [operator.callsign]);

  const handleEditContact = (contact) => {
    setEditingContactId(contact.id);
    setEditContactData({
      callsign: contact.callsign,
      frequency: contact.frequency,
      mode: contact.mode,
      classSent: contact.classSent,
      locationReceived: contact.locationReceived,
      notes: contact.notes
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await apiFetch(`/api/contacts/${editingContactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...editContactData,
          operator: operator.callsign || 'Unknown'
        }),
      });

      if (response.ok) {
        const updatedContact = await response.json();
        
        // Update local state
        setContacts(prev => prev.map(contact => 
          contact.id === editingContactId 
            ? updatedContact
            : contact
        ));
        
        setShowEditModal(false);
        setEditingContactId(null);
        setEditContactData({});
      } else {
        alert('Failed to save contact. Please try again.');
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Error saving contact. Please check the console for details.');
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingContactId(null);
    setEditContactData({});
  };

  const handleDeleteContact = (contact) => {
    if (window.confirm(`Are you sure you want to delete the contact with ${contact.callsign}? This action cannot be undone.`)) {
      deleteContact(contact.id);
    }
  };

  const deleteContact = async (contactId) => {
    try {
      const response = await apiFetch(`/api/contacts/${contactId}?operator=${operator.callsign || 'Unknown'}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update local state to mark as deleted
        setContacts(prev => prev.map(contact => 
          contact.id === contactId 
            ? { ...contact, deleted: 'Y' }
            : contact
        ));
      } else {
        alert('Failed to delete contact. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Error deleting contact. Please check the console for details.');
    }
  };

  const updateOperatorHeartbeat = async () => {
    if (!operator.callsign) return;
    
    try {
      const currentOperator = activeOperators.find(op => op.callsign === operator.callsign);
      if (currentOperator) {
        const updatedOperator = {
          ...currentOperator,
          timestamp: new Date().toISOString()
        };
        await updateActiveOperator(updatedOperator);
      }
    } catch (error) {
      console.error('Error updating operator heartbeat:', error);
    }
  };

  // Save operator to cookies when it changes
  useEffect(() => {
    if (operator.callsign) {
      setCookie('hamlog_operator_callsign', operator.callsign);
      setCookie('hamlog_operator_name', operator.name);
    } else {
      // Clear cookies when operator is logged out
      setCookie('hamlog_operator_callsign', '', -1);
      setCookie('hamlog_operator_name', '', -1);
    }
  }, [operator.callsign, operator.name]);

  // Save frequency and mode to cookies when they change
  useEffect(() => {
    setCookie('hamlog_frequency', formData.frequency);
    setCookie('hamlog_mode', formData.mode);
  }, [formData.frequency, formData.mode]);

  // Cleanup map when popup is closed
  useEffect(() => {
    if (!showCallsignPopup && mapInstance) {
      mapInstance.remove();
      setMapInstance(null);
    }
  }, [showCallsignPopup, mapInstance]);

  // Load active operators on component mount and set up polling
  // This ensures real-time updates when other operators join/leave
  useEffect(() => {
    console.log('Setting up active operators polling...');
    loadActiveOperators();
    
    // Set up polling to refresh active operators every 3 seconds for better real-time updates
    const pollInterval = setInterval(() => {
      console.log('Polling for active operators...');
      // Add a small delay to allow server updates to complete
      setTimeout(() => {
        loadActiveOperators();
      }, 500);
    }, 3000); // Poll every 3 seconds
    
    // Set up cleanup of inactive operators every 10 minutes
    const cleanupInterval = setInterval(() => {
      console.log('Running cleanup of inactive operators...');
      cleanupInactiveOperators();
    }, 10 * 60 * 1000); // Every 10 minutes
    
    // Cleanup intervals on component unmount
    return () => {
      console.log('Cleaning up active operators polling...');
      clearInterval(pollInterval);
      clearInterval(cleanupInterval);
    };
  }, []);

  // Add operator from cookies to active operators on component mount
  useEffect(() => {
    if (operator.callsign) {
      console.log('Component mounted with operator from cookies:', operator.callsign);
      // Add a small delay to ensure active operators are loaded first
      setTimeout(() => {
        const currentOperator = activeOperators.find(op => op.callsign === operator.callsign);
        if (!currentOperator) {
          const newOperator = {
            callsign: operator.callsign,
            name: operator.name,
            frequency: formData.frequency || '',
            mode: formData.mode || '',
            timestamp: new Date().toISOString(),
            bandModeTimestamp: new Date().toISOString(),
            duplicateUser: 'N' // Will be calculated by server
          };
          console.log('Adding operator from cookies on mount:', newOperator);
          addActiveOperator(newOperator);
        } else {
          console.log('Operator already exists in active operators:', currentOperator);
        }
      }, 1000); // Wait 1 second for active operators to load
    }
  }, [operator.callsign, formData.frequency, formData.mode]); // Run when operator or form data changes

  // Debug: Monitor activeOperators state changes
  useEffect(() => {
    console.log('Active operators state changed:', activeOperators.length, 'operators');
    activeOperators.forEach(op => {
      console.log(`  ${op.callsign}: ${op.frequency} ${op.mode} (duplicateUser: ${op.duplicateUser})`);
    });
  }, [activeOperators]);

  const cleanupInactiveOperators = async () => {
    try {
      const response = await apiFetch('/api/active-operators/cleanup');
      if (response.ok) {
        const result = await response.json();
        console.log('Cleanup result:', result);
        // Reload active operators after cleanup
        loadActiveOperators();
      }
    } catch (error) {
      console.error('Error cleaning up inactive operators:', error);
    }
  };



  // Ensure operator is added to active operators when loaded from cookies
  useEffect(() => {
    if (operator.callsign) {
      const currentOperator = activeOperators.find(op => op.callsign === operator.callsign);
      if (!currentOperator) {
        // Operator is set but not in active operators list, add them
        const newOperator = {
          callsign: operator.callsign,
          name: operator.name,
          frequency: formData.frequency || '',
          mode: formData.mode || '',
          timestamp: new Date().toISOString(),
          bandModeTimestamp: new Date().toISOString()
        };
        console.log('Adding operator from cookies to active operators:', newOperator);
        addActiveOperator(newOperator);
      }
    }
  }, [operator.callsign, activeOperators, formData.frequency, formData.mode]);

  // Update active operator when form data changes (if operator is set)
  useEffect(() => {
    if (operator.callsign) {
      const currentOperator = activeOperators.find(op => op.callsign === operator.callsign);
      if (currentOperator && (currentOperator.frequency !== formData.frequency || currentOperator.mode !== formData.mode)) {
        const updatedOperator = {
          ...currentOperator,
          frequency: formData.frequency,
          mode: formData.mode,
          timestamp: new Date().toISOString(), // Update activity timestamp
          bandModeTimestamp: new Date().toISOString() // Update band/mode change timestamp
        };
        
        console.log('Updating operator with new band/mode:', {
          callsign: updatedOperator.callsign,
          frequency: updatedOperator.frequency,
          mode: updatedOperator.mode,
          bandModeTimestamp: updatedOperator.bandModeTimestamp
        });
        
        // Update in database - server will handle duplicate flag calculation
        updateActiveOperator(updatedOperator);
      }
    }
  }, [formData.frequency, formData.mode, operator.callsign]);

  const updateActiveOperator = async (operatorData) => {
    try {
      console.log('Sending operator update to server:', operatorData);
      const response = await apiFetch(`/api/active-operators/${operatorData.callsign}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(operatorData)
      });
      
      if (response.ok) {
        // Don't reload immediately to avoid flickering - let the polling handle it
        console.log('Successfully updated operator in database:', operatorData.callsign);
        const responseData = await response.json();
        console.log('Server response:', responseData);
      } else {
        console.error('Failed to update operator in database:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error updating active operator:', error);
    }
  };

  // Removed old preciseStateBoundaries and calculatePreciseCoordinates for debugging

  return (
    <div className={`app-container${isPublicDisplay ? ' app-container-display' : ''}`}>
      {!isPublicDisplay && !isAboutPage && (
      <div className="header-bar">
        <div className="header-content">
          <nav className="header-nav header-nav-left desktop-only">
            <Link to="/" className="nav-link">Logbook</Link>
            {(!loggedInUser || status.userIsAdmin) && (
              <Link to="/admin" className="nav-link">Admin</Link>
            )}
          </nav>
          <h1>
            <img src={BRAND_ASSETS.logoWhite} alt="" className="header-logo" aria-hidden="true" />
            {clubName || APP_NAME}
          </h1>
          <div className="header-datetime">
            <div className="header-date">{formatCurrentDate()}</div>
            <div className="header-time">{formatCurrentTime()}</div>
          </div>
        </div>
      </div>
      )}

      <Routes>
        <Route path="/" element={
          <>
            {/* Main Content */}
            <div className="main-content">
        {/* Top 3/4 - Logs and Score */}
        <div className="logs-section">
          <div className="container">
            <div className="logs-score-container">
              {/* Left Column - Logs */}
              <div className="left-column">
                {/* Logs Box */}
                <div className="card logs-card">
                  <h2>Recent Contacts ({contacts.length})</h2>
                  {contacts.length === 0 ? (
                    <p>No contacts logged yet. Add your first contact below!</p>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th><span className="th-full">Time (UTC)</span><span className="th-short">UTC</span></th>
                            <th><span className="th-full">Callsign</span><span className="th-short">Call</span></th>
                            <th>Name</th>
                            <th>Band</th>
                            <th>Mode</th>
                            <th>Class</th>
                            <th><span className="th-full">Location</span><span className="th-short">Loc</span></th>
                            <th><span className="th-full">Operator</span><span className="th-short">Op</span></th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map(contact => (
                            <tr 
                              key={contact.id}
                              className="contact-row"
                              onMouseEnter={(e) => e.currentTarget.classList.add('hovered')}
                              onMouseLeave={(e) => e.currentTarget.classList.remove('hovered')}
                            >
                              <td>{formatUTCTime(contact.timestamp)}</td>
                              <td 
                                className="callsign-cell"
                                onMouseEnter={(e) => showCallsignDetails(contact.callsign, e)}
                                onMouseLeave={() => setShowCallsignPopup(false)}
                              >
                                <strong>{contact.callsign}</strong>
                              </td>
                              <td 
                                className="name-cell"
                                onMouseEnter={(e) => showCallsignDetails(contact.callsign, e)}
                                onMouseLeave={() => setShowCallsignPopup(false)}
                              >
                                {contact.name || '-'}
                              </td>
                              <td>{contact.frequency}</td>
                              <td>{contact.mode}</td>
                              <td>{contact.classSent || '-'}</td>
                              <td>{contact.locationReceived}</td>
                              <td>{getContactOperator(contact) || '-'}</td>
                              <td className="notes-cell">
                                <span className="notes-text">{contact.notes}</span>
                                <div className="row-actions">
                                  <button
                                    className="btn-row-edit"
                                    onClick={() => handleEditContact(contact)}
                                    title="Edit contact"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn-row-delete"
                                    onClick={() => handleDeleteContact(contact)}
                                    title="Delete contact"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Form Box */}
                <div className="card form-card">
                  <div className="form-header">
                    <h2>Add New Contact</h2>
                    <div className="form-exchange-display">
                      {projectedScore.exchange ? (
                        <>Your Exchange: <strong>{projectedScore.exchange}</strong></>
                      ) : (
                        <span className="form-exchange-placeholder">Set class &amp; section in Admin → Station Settings</span>
                      )}
                    </div>
                    <div className="operator-field">
                      <span className="operator-label">Operator:</span>
                      <span className={`operator-callsign ${!operator.callsign ? 'not-set' : ''}`}>
                        {operator.callsign || 'Not Set'}
                      </span>
                      {!loggedInUser && (
                        <button
                          type="button"
                          className="btn-change-operator"
                          onClick={handleOpenOperatorModal}
                        >
                          {operator.callsign ? 'Change' : 'Set'}
                        </button>
                      )}
                      {loggedInUser && operator.callsign && (
                        <button
                          type="button"
                          className="btn-change-operator"
                          onClick={() => setShowChangePasswordModal(true)}
                          title="Change your password"
                        >
                          Password
                        </button>
                      )}
                      {operator.callsign && (
                        <button
                          type="button"
                          className="btn-logout-operator"
                          onClick={handleOperatorLogout}
                          title={loggedInUser ? 'Sign out' : 'Logout operator'}
                        >
                          Logout
                        </button>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} noValidate>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="callsign">Callsign *</label>
                        <div className="callsign-input-container">
                          <input
                            type="text"
                            id="callsign"
                            name="callsign"
                            value={formData.callsign}
                            onChange={(e) => {
                              const upperValue = e.target.value.toUpperCase();
                              setFieldErrors((prev) => ({ ...prev, callsign: undefined }));
                              setLicenseNotice(null);
                              setFormData(prev => ({
                                ...prev, 
                                callsign: upperValue,
                                name: upperValue ? prev.name : ''
                              }));
                            }}
                            placeholder="e.g., W1AW"
                            className={`${fieldErrors.callsign ? 'field-required' : ''} ${isDuplicateEntry ? 'invalid-callsign' : ''} ${!operator.callsign ? 'disabled-field' : ''}`}
                            disabled={!operator.callsign}
                          />
                          {fieldErrors.callsign === 'required' && (
                            <span className="field-required-text">PLEASE FILL OUT THIS FIELD</span>
                          )}
                          {isDuplicateEntry && (
                            <span className="invalid-callsign-text">DUPLICATE ENTRY</span>
                          )}
                        </div>
                        {licenseNotice
                          && formData.callsign.toUpperCase() === licenseNotice.callsign && (
                          <div className="callsign-license-notice" role="alert">
                            FCC license expired
                            {licenseNotice.expiryDate ? ` on ${licenseNotice.expiryDate}` : ''}.
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          readOnly
                          placeholder="Auto-populated from callsign"
                          className={`readonly-field ${!operator.callsign ? 'disabled-field' : ''}`}
                          disabled={!operator.callsign}
                          onMouseEnter={(e) => formData.callsign && showCallsignDetails(formData.callsign, e)}
                          onMouseLeave={() => setShowCallsignPopup(false)}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="frequency" className="tooltip-label">
                          Band
                          <InfoTooltip text={BAND_TOOLTIP} />
                        </label>
                        <select
                          id="frequency"
                          name="frequency"
                          value={formData.frequency}
                          onChange={handleInputChange}
                          disabled={!operator.callsign}
                          className={`${!operator.callsign ? 'disabled-field' : ''} ${isBandModeConflict ? 'invalid-band-mode' : ''}`}
                          data-conflict={isBandModeConflict ? 'true' : 'false'}
                        >
                          <option value="">Select Band</option>
                          {frequencyBands.map(band => (
                            <option key={band.value} value={band.label}>{band.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="mode" className="tooltip-label">
                          Mode
                          <InfoTooltip text={MODE_TOOLTIP} />
                        </label>
                        <select
                          id="mode"
                          name="mode"
                          value={formData.mode}
                          onChange={handleInputChange}
                          disabled={!operator.callsign}
                          className={`${!operator.callsign ? 'disabled-field' : ''} ${isBandModeConflict ? 'invalid-band-mode' : ''}`}
                          data-conflict={isBandModeConflict ? 'true' : 'false'}
                        >
                          {modes.map(mode => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {isBandModeConflict && (
                      <div className="form-row">
                        <div className="form-group">
                          <span className="invalid-band-mode-text">
                            WARNING: Band {formData.frequency} {formData.mode} is already in use by {formatOperatorNames(operatorsWithSameBandMode.filter(op => op.callsign !== operator.callsign).map(op => ({ callsign: op.callsign, name: op.name || 'Unknown' })))}
                          </span>
                        </div>
                      </div>
                    )}


                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="classSent" className="tooltip-label">
                          Class
                          <InfoTooltip text={ARRL_CLASS_TOOLTIP} />
                        </label>
                        <div className="class-input-container">
                          <input
                            type="text"
                            id="classSent"
                            name="classSent"
                            value={formData.classSent}
                            onChange={(e) => {
                              const upperValue = e.target.value.toUpperCase();
                              setFieldErrors((prev) => ({ ...prev, classSent: undefined }));
                              setFormData({...formData, classSent: upperValue});
                            }}
                            placeholder={ARRL_CLASS_PLACEHOLDER}
                            className={`${isClassMissing || isClassInvalid ? 'field-required' : ''} ${!operator.callsign ? 'disabled-field' : ''}`}
                            disabled={!operator.callsign}
                          />
                          {isClassMissing && (
                            <span className="field-required-text">PLEASE FILL OUT THIS FIELD</span>
                          )}
                          {isClassInvalid && !isClassMissing && (
                            <span className="field-required-text">INVALID CLASS</span>
                          )}
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="locationReceived" className="tooltip-label">
                          Location
                          <InfoTooltip text={LOCATION_TOOLTIP} />
                        </label>
                        <div className="location-input-container">
                          <input
                            type="text"
                            id="locationReceived"
                            name="locationReceived"
                            value={formData.locationReceived}
                            onChange={(e) => {
                              const upperValue = e.target.value.toUpperCase();
                              setFieldErrors((prev) => ({ ...prev, locationReceived: undefined }));
                              setFormData(prev => ({
                                ...prev, 
                                locationReceived: upperValue,
                                callSignArea: upperValue ? prev.callSignArea : '' // Clear call sign area when location is cleared
                              }));
                            }}
                            placeholder="e.g., AZ, DX"
                            className={`${isLocationMissing || isLocationInvalid ? 'field-required' : ''} ${!operator.callsign ? 'disabled-field' : ''}`}
                            disabled={!operator.callsign}
                          />
                          {isLocationMissing && (
                            <span className="field-required-text">PLEASE FILL OUT THIS FIELD</span>
                          )}
                          {isLocationInvalid && !isLocationMissing && (
                            <span className="field-required-text">INVALID LOCATION</span>
                          )}
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="callSignArea">Call Sign Area</label>
                        <input
                          type="text"
                          id="callSignArea"
                          name="callSignArea"
                          value={formData.callSignArea}
                          readOnly
                          placeholder="Auto-populated from location"
                          className={`readonly-field ${!operator.callsign ? 'disabled-field' : ''}`}
                          disabled={!operator.callsign}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="notes">Notes</label>
                        <input
                          type="text"
                          id="notes"
                          name="notes"
                          value={formData.notes}
                          onChange={handleInputChange}
                          placeholder="Optional notes"
                          className={!operator.callsign ? 'disabled-field' : ''}
                          disabled={!operator.callsign}
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className={`btn ${!operator.callsign || !formData.frequency || !formData.mode ? 'btn-disabled' : ''}`}
                      disabled={!operator.callsign || !formData.frequency || !formData.mode}
                    >
                      Log Contact
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column - Score and Sections */}
              <div className="right-column">
                {/* Top Row - Active Operators and Score */}
                <div className="top-row">
                  {/* Active Operators Box */}
                  <div className="card operators-card">
                    <h3>Active Operators</h3>
                    {activeOperators.length > 0 ? (
                      <div className="operators-list">
                        {activeOperators.map((op, index) => {
                          // Use the duplicateUser field from the database
                          const isHighlighted = op.duplicateUser === 'Y';
                          
                          console.log(`Rendering operator ${op.callsign}: duplicateUser=${op.duplicateUser}, isHighlighted=${isHighlighted}, className=operator-row${isHighlighted ? ' highlighted' : ''}`);
                          
                          return (
                            <div key={index} className={`operator-row ${isHighlighted ? 'highlighted' : ''}`}>
                              <span className="operator-callsign-compact">{op.callsign}</span>
                              <span className="operator-band-compact">{op.frequency}</span>
                              <span className="operator-mode-compact">
                                {op.mode === 'Phone' ? 'PH' : op.mode === 'Digital' ? 'DIG' : 'CW'}
                              </span>

                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="no-operator">
                        <div className="no-operator-text">No Active Operators</div>
                        <div className="no-operator-subtext">Set operator to begin logging</div>
                      </div>
                    )}
                  </div>

                  {/* Score Box */}
                  <div 
                    className="card score-card desktop-only"
                    onMouseEnter={() => setShowScorePopup(true)}
                    onMouseLeave={() => setShowScorePopup(false)}
                    style={{ cursor: 'help' }}
                    title="Hover to view individual operator scores"
                  >
                    <h3>{hasStationConfig ? 'Projected Score' : 'QSO Points'}</h3>
                    <div className="score-value">
                      {hasStationConfig ? projectedScore.finalScore : qsoPoints}
                    </div>
                    <div className="score-breakdown">
                      <div className="breakdown-line">
                        Phone: {scoreBreakdown.phone} × 1 = {scoreBreakdown.phone} | CW: {scoreBreakdown.cw} × 2 = {scoreBreakdown.cw * 2} | Digital: {scoreBreakdown.digital} × 2 = {scoreBreakdown.digital * 2}
                      </div>
                      {hasStationConfig ? (
                        <>
                          <div className="breakdown-line score-note">
                            {qsoPoints} QSO × {projectedScore.powerMultiplier} + {projectedScore.bonusPoints} bonus
                          </div>
                        </>
                      ) : (
                        <div className="breakdown-line score-note">
                          Set station class in Admin → Station Settings
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ARRL Sections Box */}
                <div className="card sections-card desktop-only">
                  <h3 
                    className="sections-progress-title"
                    onClick={() => setShowARRLMap(true)}
                    title="Click to view sections map"
                  >
                    ARRL Sections Progress
                  </h3>
                  <div className="sections-grid">
                    {Object.entries(sectionsByArea).map(([area, sections]) => {
                      const isLarge = sections.length > 10; // Only sections with more than 10 items get full row
                      return (
                        <div key={area} className={`area-group ${isLarge ? 'large' : ''}`}>
                          <h4
                            className="area-title"
                            style={{
                              backgroundColor: isAreaComplete(sections) ? '#356211' : undefined,
                              color: isAreaComplete(sections) ? 'white' : undefined
                            }}
                          >
                            {getAreaLabel(area)}
                          </h4>
                          <div className="sections-list">
                            {sections.map(section => {
                              const isLogged = contacts.some(contact => 
                                contact.locationReceived.toUpperCase() === section.toUpperCase()
                              );
                              return (
                                <span 
                                  key={section} 
                                  className={`section-item ${isLogged ? 'logged' : 'unlogged'}`}
                                  onMouseEnter={(e) => handleSectionMouseEnter(e, section)}
                                  onMouseLeave={handleSectionMouseLeave}
                                >
                                  {section}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Callsign Details Popup */}
      {showCallsignPopup && callsignPopupData && (
        <div 
          className="callsign-popup-overlay"
          onClick={() => setShowCallsignPopup(false)}
        >
          <div 
            className="callsign-popup-content"
            ref={callsignPopupRef}
            style={{
              left: callsignPopupStyle.left,
              top: callsignPopupStyle.top,
              visibility: callsignPopupPlaced ? 'visible' : 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="callsign-popup-header">
              <h4>{callsignPopupData.callsign}</h4>
              <button 
                className="popup-close-btn"
                onClick={() => setShowCallsignPopup(false)}
              >
                ×
              </button>
            </div>
            
            <div className="callsign-popup-body">
              {callsignPopupData.isExpired && (
                <div className="callsign-expired-notice">
                  FCC license expired{callsignPopupData.expiryDate ? ` on ${callsignPopupData.expiryDate}` : ''}.
                </div>
              )}
              <div className="callsign-info">
                <div className="info-row">
                  <strong>Name:</strong> {callsignPopupData.name || 'N/A'}
                </div>
                <div className="info-row">
                  <strong>Grid:</strong> {callsignPopupData.grid || 'N/A'}
                </div>
                {callsignPopupData.city && (
                  <div className="info-row">
                    <strong>City:</strong> {callsignPopupData.city}
                  </div>
                )}
                {callsignPopupData.state && (
                  <div className="info-row">
                    <strong>State:</strong> {callsignPopupData.state}
                  </div>
                )}
                {callsignPopupData.country && 
                 callsignPopupData.country !== 'United States' && 
                 callsignPopupData.country !== 'Canada' && (
                  <div className="info-row">
                    <strong>Country:</strong> {callsignPopupData.country}
                  </div>
                )}
              </div>
              
                          {callsignPopupData.grid && (
              <div className="map-container">
                <div id={mapContainerId} className="map-container-inner" style={{minHeight: '200px'}}></div>
                <div className="grid-info">
                  <div className="grid-coordinates">{callsignPopupData.grid}</div>
                  <div className="map-note">Grid Square Location</div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Score Statistics Popup */}
      {showScorePopup && (
        <div className="score-popup-overlay">
          <div className="score-popup-content">
            <div className="score-popup-header">
              <h4>Individual Operator Scores</h4>
            </div>
            
            <div className="score-popup-body">
              {hasStationConfig && (
                <div className="projected-score-summary">
                  <div><strong>Projected Field Day Score:</strong> {projectedScore.finalScore}</div>
                  <div className="score-detail">
                    {qsoPoints} QSO × {projectedScore.powerMultiplier} + {projectedScore.bonusPoints} bonus
                  </div>
                  {projectedScore.exchange && (
                    <div className="score-detail">Exchange: {projectedScore.exchange}</div>
                  )}
                </div>
              )}
              {Object.keys(operatorScores).length === 0 ? (
                <div className="info-row">
                  <strong>No operator scores available</strong>
                  <div>Operators need to log contacts to see individual scores</div>
                </div>
              ) : (
                <div className="operator-scores-list">
                  {Object.entries(operatorScores)
                    .sort(([,a], [,b]) => b.total - a.total) // Sort by total score descending
                    .map(([operatorCallsign, scores]) => (
                      <div key={operatorCallsign} className="operator-score-item">
                        <div className="operator-score-header">
                          <strong>{operatorCallsign}</strong>
                          <span className="operator-total-score">{scores.total} pts</span>
                        </div>
                        <div className="operator-score-breakdown">
                          <div className="score-detail">
                            <span>Phone: {scores.phone} × 1 = {scores.phone}</span>
                          </div>
                          <div className="score-detail">
                            <span>CW: {scores.cw} × 2 = {scores.cw * 2}</span>
                          </div>
                          <div className="score-detail">
                            <span>Digital: {scores.digital} × 2 = {scores.digital * 2}</span>
                          </div>
                          <div className="score-detail">
                            <span>Unique Sections: {scores.uniqueSections}</span>
                          </div>
                          <div className="score-detail total-contacts">
                            <span>Total Contacts: {scores.contacts}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ARRL Sections Map Popup */}
      {showARRLMap && (
        <div 
          className="sections-map-overlay"
          onClick={() => setShowARRLMap(false)}
        >
          <div 
            className="sections-map-popup-content sections-map-popup-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sections-map-popup-header">
              <h3>ARRL Sections Map</h3>
              <div className="sections-map-popup-actions">
                <a
                  href="/display"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sections-map-open-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open in Separate Tab ↗
                </a>
                <button 
                  className="popup-close-btn"
                  onClick={() => setShowARRLMap(false)}
                >
                  ×
                </button>
              </div>
            </div>
            <ArrlSectionsMap contacts={contacts} height={600} showOpenLink={false} />
          </div>
        </div>
      )}

      {showChangePasswordModal && loggedInUser && status.userCallsign && (
        <ChangePasswordModal
          callsign={status.userCallsign}
          onClose={(saved) => {
            setShowChangePasswordModal(false);
            if (saved) {
              alert('Password updated successfully.');
            }
          }}
        />
      )}

      {/* Operator Change Modal */}
      {showOperatorModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Change Operator</h3>
            <form onSubmit={handleOperatorSubmit}>
              <div className="form-group">
                <label htmlFor="operatorCallsign">Callsign</label>
                <input
                  type="text"
                  id="operatorCallsign"
                  name="callsign"
                  value={operatorModalData.callsign}
                  onChange={handleOperatorChange}
                  placeholder="e.g., K1FMK"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="operatorName">Name</label>
                <input
                  type="text"
                  id="operatorName"
                  name="name"
                  value={operatorModalData.name}
                  readOnly
                  placeholder="Auto-populated from callsign"
                  className="readonly-field"
                />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="btn">Save</button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowOperatorModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

            {/* Edit Contact Modal */}
            {showEditModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3>Edit Contact</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="editCallsign">Callsign</label>
                        <input
                          type="text"
                          id="editCallsign"
                          value={editContactData.callsign || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, callsign: e.target.value.toUpperCase() }))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="editFrequency">Band</label>
                        <select
                          id="editFrequency"
                          value={editContactData.frequency || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, frequency: e.target.value }))}
                          required
                        >
                          <option value="">Select Band</option>
                          <option value="160">160</option>
                          <option value="80">80</option>
                          <option value="40">40</option>
                          <option value="20">20</option>
                          <option value="15">15</option>
                          <option value="10">10</option>
                          <option value="6">6 (50 MHz)</option>
                          <option value="2">2 (144 MHz)</option>
                          <option value="1.25">1.25 (222 MHz)</option>
                          <option value="70cm">70 cm (432 MHz)</option>
                          <option value="33cm">33 cm (902 MHz)</option>
                          <option value="23cm">23 cm (1.3 GHz)</option>
                          <option value="13cm">13 cm (2.3 GHz)</option>
                          <option value="9cm">9 cm (3.5 GHz)</option>
                          <option value="6cm">6 cm (5.8 GHz)</option>
                          <option value="3cm">3 cm (10 GHz)</option>
                          <option value="satellite">Satellite</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="editMode">Mode</label>
                        <select
                          id="editMode"
                          value={editContactData.mode || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, mode: e.target.value }))}
                          required
                        >
                          <option value="">Select Mode</option>
                          <option value="CW">CW</option>
                          <option value="Phone">Phone</option>
                          <option value="Digital">Digital</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="editClass">Class</label>
                        <input
                          type="text"
                          id="editClass"
                          value={editContactData.classSent || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, classSent: e.target.value }))}
                          placeholder={ARRL_CLASS_PLACEHOLDER}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="editLocation">Location</label>
                        <input
                          type="text"
                          id="editLocation"
                          value={editContactData.locationReceived || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, locationReceived: e.target.value }))}
                          placeholder="e.g., MA"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="editNotes">Notes</label>
                        <input
                          type="text"
                          id="editNotes"
                          value={editContactData.notes || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Optional notes"
                        />
                      </div>
                    </div>
                    <div className="modal-buttons">
                      <button type="submit" className="btn">Save</button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        } />
        <Route path="/admin" element={<Admin />} />
        <Route path="/display" element={<PublicDisplay />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      {!isPublicDisplay && location.pathname !== '/about' && <AppFooter />}
    </div>
  );
}

export default App;
