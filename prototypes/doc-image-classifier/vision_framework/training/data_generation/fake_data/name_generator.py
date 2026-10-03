"""
name_generator.py — Generate realistic Indian names (Hindi + English).

Includes 200 male first names, 200 female first names, 150 surnames
with their Devanagari equivalents.

Also provides OllamaNameGenerator for LLM-driven name generation that
produces novel names not in the static lists above.
"""

import random


# ── Male first names ──────────────────────────────────────────────────────────

MALE_NAMES_EN = [
    "Aarav", "Aditya", "Akash", "Alok", "Amit", "Amitabh", "Anil", "Anish",
    "Ankit", "Ankur", "Anoop", "Anshul", "Anurag", "Arjun", "Arpit", "Aryan",
    "Ashish", "Ashok", "Ashutosh", "Avinash", "Ayush", "Bharat", "Bhaskar",
    "Chetan", "Chirag", "Deepak", "Dev", "Devesh", "Dhruv", "Dinesh",
    "Gaurav", "Girish", "Gopal", "Govind", "Hardik", "Harish", "Hemant",
    "Himanshu", "Hitesh", "Ishan", "Jagdish", "Jatin", "Jay", "Jayesh",
    "Jitendra", "Kamal", "Karan", "Kartik", "Keshav", "Kuldeep", "Kumar",
    "Lalit", "Lokesh", "Manoj", "Manish", "Mayank", "Mihir", "Mohit",
    "Mukesh", "Naresh", "Naveen", "Nikhil", "Nilesh", "Niraj", "Nishant",
    "Om", "Omkar", "Pankaj", "Parth", "Pawan", "Praful", "Prasad",
    "Prashant", "Pratik", "Praveen", "Prem", "Pushkar", "Rahul", "Raj",
    "Rajat", "Rajesh", "Rajiv", "Rajan", "Rakesh", "Ramesh", "Ravi",
    "Ravindra", "Ritesh", "Rohan", "Rohit", "Sachin", "Sagar", "Sahil",
    "Sanjay", "Sanjeev", "Sanket", "Satish", "Shailesh", "Shivam", "Shubham",
    "Siddharth", "Sourabh", "Sudhir", "Sunil", "Suresh", "Sushil", "Swapnil",
    "Tarun", "Tushar", "Uday", "Umesh", "Varun", "Vijay", "Vikash",
    "Vikas", "Vikram", "Vinay", "Vineet", "Vinod", "Vivek", "Yash",
    "Yogesh", "Yuvraj", "Abhijeet", "Abhishek", "Achyut", "Adhish", "Adish",
    "Aditya", "Ajay", "Ajit", "Alok", "Ambar", "Ambuj", "Amey",
    "Anand", "Aniket", "Animesh", "Anirban", "Avinash", "Brijesh", "Chandresh",
    "Chinmay", "Darshan", "Devraj", "Dhiraj", "Durgesh", "Gagan", "Ganesh",
    "Girraj", "Harsh", "Indrajit", "Jagannath", "Jaidev", "Kailash", "Kalyan",
    "Kedar", "Kundan", "Mahesh", "Manas", "Mangesh", "Milind", "Mohan",
    "Nandan", "Narendra", "Nimesh", "Nirmal", "Nishith", "Pallav", "Paresh",
    "Piyush", "Pranav", "Prateek", "Raghav", "Raghunath", "Rajendra", "Ramakant",
    "Ranjit", "Rupesh", "Rushikesh", "Sameer", "Samir", "Sandesh", "Santosh",
    "Sarvesh", "Satendra", "Sharat", "Shivansh", "Shreyas", "Shrikant", "Shyam",
    "Siddhesh", "Soumya", "Sreejith", "Srinivas", "Subhash", "Surendra", "Sushant",
    "Tejas", "Tilak", "Ujjwal", "Utpal", "Venkatesan", "Vidyut", "Vishnu",
    "Vishrut", "Vitthal", "Vrushank", "Wasim", "Yadunath", "Yashodhan", "Yatin",
]

MALE_NAMES_HI = [
    "आरव", "आदित्य", "आकाश", "आलोक", "अमित", "अमिताभ", "अनिल", "अनीश",
    "अंकित", "अंकुर", "अनूप", "अंशुल", "अनुराग", "अर्जुन", "अर्पित", "आर्यन",
    "आशीष", "अशोक", "आशुतोष", "अविनाश", "आयुष", "भारत", "भास्कर",
    "चेतन", "चिराग", "दीपक", "देव", "देवेश", "ध्रुव", "दिनेश",
    "गौरव", "गिरीश", "गोपाल", "गोविंद", "हार्दिक", "हरीश", "हेमंत",
    "हिमांशु", "हितेश", "ईशान", "जगदीश", "जतिन", "जय", "जयेश",
    "जितेंद्र", "कमल", "करण", "कार्तिक", "केशव", "कुलदीप", "कुमार",
    "ललित", "लोकेश", "मनोज", "मनीष", "मयंक", "मिहिर", "मोहित",
    "मुकेश", "नरेश", "नवीन", "निखिल", "नीलेश", "निरज", "निशांत",
    "ओम", "ओंकार", "पंकज", "पार्थ", "पवन", "प्रफुल्ल", "प्रसाद",
    "प्रशांत", "प्रतीक", "प्रवीण", "प्रेम", "पुष्कर", "राहुल", "राज",
    "राजत", "राजेश", "राजीव", "राजन", "राकेश", "रमेश", "रवि",
    "रवींद्र", "रितेश", "रोहन", "रोहित", "सचिन", "सागर", "साहिल",
    "संजय", "संजीव", "संकेत", "सतीश", "शैलेश", "शिवम", "शुभम",
    "सिद्धार्थ", "सौरभ", "सुधीर", "सुनील", "सुरेश", "सुशील", "स्वप्निल",
    "तरुण", "तुषार", "उदय", "उमेश", "वरुण", "विजय", "विकाश",
    "विकास", "विक्रम", "विनय", "विनीत", "विनोद", "विवेक", "यश",
    "योगेश", "युवराज", "अभिजीत", "अभिषेक", "अच्युत", "अधीश", "अदीश",
    "आदित्य", "अजय", "अजीत", "आलोक", "अंबर", "अंबुज", "अमेय",
    "आनंद", "अनिकेत", "अनिमेष", "अनिर्बान", "अविनाश", "बृजेश", "चंद्रेश",
    "चिन्मय", "दर्शन", "देवराज", "धीरज", "दुर्गेश", "गगन", "गणेश",
    "गिर्राज", "हर्ष", "इंद्रजीत", "जगन्नाथ", "जयदेव", "कैलाश", "कल्याण",
    "केदार", "कुंदन", "महेश", "मानस", "मंगेश", "मिलिंद", "मोहन",
    "नंदन", "नरेंद्र", "नीमेश", "निर्मल", "निशीथ", "पल्लव", "परेश",
    "पीयूष", "प्रणव", "प्रतीक", "राघव", "रघुनाथ", "राजेंद्र", "रामकांत",
]

# ── Female first names ────────────────────────────────────────────────────────

FEMALE_NAMES_EN = [
    "Aarti", "Aishwarya", "Akanksha", "Alka", "Amita", "Amrita", "Ananya",
    "Ankita", "Anushka", "Aparna", "Archana", "Aruna", "Asha", "Bharati",
    "Bhavna", "Chanda", "Chitra", "Deepa", "Deepika", "Divya", "Durga",
    "Ekta", "Gita", "Geetanjali", "Geeta", "Heena", "Hema", "Indira",
    "Jaya", "Jayashree", "Jyoti", "Kajal", "Kalpana", "Kavita", "Kavya",
    "Kiran", "Komal", "Kritika", "Lakshmi", "Lata", "Lavanya", "Leela",
    "Madhuri", "Manisha", "Meena", "Meenakshi", "Meera", "Minal", "Mira",
    "Mohini", "Mukta", "Namrata", "Nandita", "Neelam", "Neha", "Nidhi",
    "Nisha", "Nita", "Padma", "Pallavi", "Poonam", "Pooja", "Pratibha",
    "Prerna", "Priya", "Priyanka", "Puja", "Radha", "Rasika", "Rekha",
    "Renu", "Revati", "Rinki", "Ritu", "Rohini", "Ruchika", "Rupa",
    "Sanjana", "Sarita", "Savita", "Seema", "Shanti", "Shilpa", "Shraddha",
    "Shreya", "Shubhangi", "Shweta", "Sita", "Smita", "Sneha", "Sonali",
    "Sonal", "Sonia", "Sudha", "Sujata", "Sunita", "Supriya", "Swati",
    "Tanuja", "Tanvi", "Tara", "Tulsi", "Usha", "Vandana", "Varsha",
    "Vidya", "Vijaya", "Vimala", "Vineeta", "Vrinda", "Yamini", "Yashoda",
    "Abha", "Aditi", "Akansha", "Akshata", "Amala", "Ambika", "Anita",
    "Anupama", "Arathi", "Arpita", "Asmita", "Avani", "Bhagyashri", "Bhumika",
    "Chaitali", "Chandrika", "Chhaya", "Daya", "Devyani", "Disha", "Gauri",
    "Girija", "Gunjan", "Harshada", "Harshali", "Hemali", "Isha", "Ishwari",
    "Janaki", "Jasmine", "Jagruti", "Jayanti", "Jhanvi", "Kalyani", "Kamakshi",
    "Kamla", "Karishma", "Ketaki", "Khushboo", "Lalita", "Laxmi", "Leena",
    "Madhavi", "Maitreyi", "Mamata", "Manya", "Minakshi", "Mohana", "Mrunal",
    "Nalini", "Nandini", "Nayana", "Nilima", "Nimisha", "Nirupama", "Nutan",
    "Payal", "Piyali", "Pradnya", "Prajakta", "Pranali", "Pranati", "Prapti",
    "Preethi", "Preeti", "Priyal", "Rajashree", "Rajlakshmi", "Rajni", "Raksha",
    "Ramya", "Ranjeeta", "Rashmi", "Ratna", "Reena", "Revathi", "Riddhi",
    "Roshani", "Rucha", "Rupali", "Rutuja", "Sahana", "Sanika", "Sanskriti",
    "Sapna", "Saroj", "Sayali", "Shaila", "Shampa", "Shanta", "Sharmila",
    "Shikha", "Shivangi", "Siddhi", "Simran", "Sonal", "Sucheta", "Surekha",
    "Sushma", "Swapna", "Tanushree", "Tejaswini", "Triveni", "Urmila", "Vaishali",
    "Vasudha", "Vedika", "Vibha", "Vidu", "Vinita", "Vipula", "Vishakha",
]

FEMALE_NAMES_HI = [
    "आरती", "ऐश्वर्या", "आकांक्षा", "अल्का", "अमिता", "अमृता", "अनन्या",
    "अंकिता", "अनुष्का", "अपर्णा", "अर्चना", "अरुणा", "आशा", "भारती",
    "भावना", "चांदा", "चित्रा", "दीपा", "दीपिका", "दिव्या", "दुर्गा",
    "एकता", "गीता", "गीतांजलि", "गीता", "हीना", "हेमा", "इंदिरा",
    "जया", "जयश्री", "ज्योति", "काजल", "कल्पना", "कविता", "काव्या",
    "किरण", "कोमल", "कृतिका", "लक्ष्मी", "लता", "लावण्या", "लीला",
    "माधुरी", "मनीषा", "मीना", "मीनाक्षी", "मीरा", "मीनल", "मीरा",
    "मोहिनी", "मुक्ता", "नम्रता", "नंदिता", "नीलम", "नेहा", "निधि",
    "निशा", "नीता", "पद्मा", "पल्लवी", "पूनम", "पूजा", "प्रतिभा",
    "प्रेरणा", "प्रिया", "प्रियंका", "पूजा", "राधा", "रसिका", "रेखा",
    "रेणु", "रेवती", "रिंकी", "रितु", "रोहिणी", "रुचिका", "रूपा",
    "संजना", "सरिता", "सविता", "सीमा", "शांति", "शिल्पा", "श्रद्धा",
    "श्रेया", "शुभांगी", "श्वेता", "सीता", "स्मिता", "स्नेहा", "सोनाली",
    "सोनल", "सोनिया", "सुधा", "सुजाता", "सुनीता", "सुप्रिया", "स्वाति",
    "तनुजा", "तनवी", "तारा", "तुलसी", "उषा", "वंदना", "वर्षा",
    "विद्या", "विजया", "विमला", "विनीता", "वृंदा", "यामिनी", "यशोदा",
    "आभा", "अदिति", "आकांशा", "अक्षता", "अमला", "अंबिका", "अनिता",
    "अनुपमा", "आरती", "अर्पिता", "अस्मिता", "अवनि", "भाग्यश्री", "भूमिका",
    "चैताली", "चंद्रिका", "छाया", "दया", "देव्यानी", "दिशा", "गौरी",
    "गिरिजा", "गुंजन", "हर्षदा", "हर्षाली", "हेमाली", "ईशा", "ईश्वरी",
    "जानकी", "जैस्मिन", "जागृति", "जयंती", "जान्हवी", "कल्याणी", "कामाक्षी",
    "कमला", "करिश्मा", "केतकी", "खुशबू", "ललिता", "लक्ष्मी", "लीना",
]

# ── Surnames ──────────────────────────────────────────────────────────────────

SURNAMES_EN = [
    "Agarwal", "Ahuja", "Anand", "Arora", "Awasthi", "Bajaj", "Balasubramaniam",
    "Banerjee", "Bhat", "Bhatt", "Bhattacharya", "Bose", "Chandra", "Chatterjee",
    "Chauhan", "Chaudhary", "Chopra", "Chowdhury", "Das", "Dave", "Desai",
    "Deshpande", "Dey", "Dixit", "Dubey", "Dutta", "Garg", "Ghosh",
    "Goswami", "Goyal", "Gupta", "Iyer", "Jain", "Jha", "Joshi",
    "Kapoor", "Kaur", "Khanna", "Kulkarni", "Kumar", "Lal", "Luthra",
    "Mathur", "Mehta", "Menon", "Mishra", "Mittal", "Modi", "Mukherjee",
    "Nair", "Naidu", "Nanda", "Pandey", "Pant", "Patel", "Pathak",
    "Pillai", "Prasad", "Rao", "Rastogi", "Rathi", "Reddy", "Roy",
    "Saha", "Sahni", "Saxena", "Sen", "Shah", "Sharma", "Shukla",
    "Singh", "Sinha", "Soni", "Srivastava", "Tiwari", "Trivedi", "Upadhyay",
    "Varma", "Verma", "Yadav", "Agnihotri", "Bajpai", "Bali", "Batra",
    "Bhargava", "Bhosale", "Biswas", "Chakraborty", "Chaki", "Dalal", "Dayal",
    "Dewangan", "Dhawan", "Doshi", "Dube", "Duggal", "Fulzele", "Gaur",
    "Goel", "Guha", "Gulati", "Gurjar", "Hegde", "Hiremath", "Hora",
    "Jadhav", "Jaiswal", "Jagtap", "Jindal", "Johri", "Kadam", "Kale",
    "Kamble", "Kashyap", "Khatri", "Khullar", "Kini", "Kiran", "Kohli",
    "Kori", "Krishnan", "Lamba", "Lokhande", "Madan", "Mahi", "Malhotra",
    "Mandal", "Mangal", "Mistry", "Mitra", "Nagpal", "Negi", "Nikam",
]

SURNAMES_HI = [
    "अग्रवाल", "आहुजा", "आनंद", "अरोड़ा", "अवस्थी", "बजाज", "बालसुब्रमण्यम",
    "बनर्जी", "भट", "भट्ट", "भट्टाचार्य", "बोस", "चंद्र", "चटर्जी",
    "चौहान", "चौधरी", "चोपड़ा", "चौधरी", "दास", "दवे", "देसाई",
    "देशपांडे", "दे", "दीक्षित", "दुबे", "दत्त", "गर्ग", "घोष",
    "गोस्वामी", "गोयल", "गुप्ता", "अय्यर", "जैन", "झा", "जोशी",
    "कपूर", "कौर", "खन्ना", "कुलकर्णी", "कुमार", "लाल", "लूथरा",
    "माथुर", "मेहता", "मेनन", "मिश्रा", "मित्तल", "मोदी", "मुखर्जी",
    "नायर", "नायडू", "नंदा", "पांडेय", "पंत", "पटेल", "पाठक",
    "पिल्लई", "प्रसाद", "राव", "रस्तोगी", "राठी", "रेड्डी", "रॉय",
    "साहा", "साहनी", "सक्सेना", "सेन", "शाह", "शर्मा", "शुक्ल",
    "सिंह", "सिन्हा", "सोनी", "श्रीवास्तव", "तिवारी", "त्रिवेदी", "उपाध्याय",
    "वर्मा", "वर्मा", "यादव", "अग्निहोत्री", "बाजपेई", "बाली", "बत्रा",
    "भार्गव", "भोसले", "बिस्वास", "चक्रवर्ती", "चाकी", "दलाल", "दयाल",
    "देवांगन", "धवन", "दोशी", "दुबे", "डुग्गल", "फुलज़ेले", "गौर",
    "गोयल", "गुहा", "गुलाटी", "गुर्जर", "हेगड़े", "हिरेमठ", "होरा",
    "जाधव", "जायसवाल", "जगताप", "जिंदल", "जोहरी", "कदम", "काले",
    "कांबले", "कश्यप", "खत्री", "खुल्लर", "किनी", "किरण", "कोहली",
    "कोरी", "कृष्णन", "लांबा", "लोखंडे", "मदान", "माही", "मल्होत्रा",
    "मंडल", "मंगल", "मिस्त्री", "मित्रा", "नागपाल", "नेगी", "निकम",
]


class OllamaNameGenerator:
    """
    Generates realistic Indian names via Ollama LLM.

    Produces novel names not in the hardcoded lists, useful for
    generating diverse synthetic datasets.  Falls back to the
    static NameGenerator when Ollama is unavailable.

    Usage:
        gen = OllamaNameGenerator()
        name = gen.generate('M')   # {'full_en': ..., 'full_hi': ..., 'gender': 'M'}
    """

    _BATCH_SIZE = 100

    def __init__(self) -> None:
        self._fallback = NameGenerator()
        self._cache: list = []
        self._ollama = None
        try:
            from vision_framework.core.llm.ollama_client import OllamaClient
            self._ollama = OllamaClient()
            self._prefill_cache(self._BATCH_SIZE)
        except Exception:
            # Ollama not available — silently fall back to static lists
            pass

    def _prefill_cache(self, count: int) -> None:
        """Generate *count* names in a single Ollama call."""
        if self._ollama is None:
            return
        print(f"[OllamaNameGen] Generating {count} Indian names via Ollama...")
        result = self._ollama.generate_json(
            f"""Generate {count} realistic Indian names for identity documents.
Include both male and female names from different regions of India.
Return JSON:
{{
  "names": [
    {{
      "english": "Full Name",
      "hindi": "पूरा नाम",
      "gender": "M or F",
      "region": "north or south or west or east"
    }}
  ]
}}""",
            task="general",
        )
        names = result.get("names", [])
        self._cache = names
        print(f"[OllamaNameGen] Cached {len(self._cache)} names")

    def generate(self, gender: str = None) -> dict:
        """
        Return one name dict with keys: full_en, full_hi, gender.

        Falls back to static NameGenerator if Ollama cache is empty.
        """
        if not self._cache:
            if self._ollama is not None:
                self._prefill_cache(self._BATCH_SIZE)
            if not self._cache:
                fb = self._fallback.generate(gender or "M")
                return {"full_en": fb["full_en"], "full_hi": fb["full_hi"],
                        "gender": fb.get("gender", gender or "M")}

        filtered = [
            n for n in self._cache
            if gender is None or n.get("gender", "M") == gender
        ] or self._cache

        name = random.choice(filtered)
        self._cache.remove(name)

        return {
            "full_en": name.get("english", ""),
            "full_hi": name.get("hindi", ""),
            "gender":  name.get("gender", gender or "M"),
        }


class NameGenerator:
    """Generates realistic Indian names with Hindi and English forms."""

    def generate(self, gender: str = "M") -> dict:
        """
        Returns:
            dict with keys: first_en, last_en, first_hi, last_hi,
                            full_en, full_hi
        """
        if gender.upper() in ("M", "MALE"):
            first_en = random.choice(MALE_NAMES_EN)
            first_hi = random.choice(MALE_NAMES_HI)
        else:
            first_en = random.choice(FEMALE_NAMES_EN)
            first_hi = random.choice(FEMALE_NAMES_HI)

        idx = random.randrange(len(SURNAMES_EN))
        last_en = SURNAMES_EN[idx]
        last_hi = SURNAMES_HI[idx]

        return {
            "first_en": first_en,
            "last_en": last_en,
            "first_hi": first_hi,
            "last_hi": last_hi,
            "full_en": f"{first_en} {last_en}",
            "full_hi": f"{first_hi} {last_hi}",
        }
