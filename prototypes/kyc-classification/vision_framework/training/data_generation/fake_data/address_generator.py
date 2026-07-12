"""
address_generator.py — Generate realistic Indian postal addresses.

Also provides OllamaAddressGenerator for LLM-driven address generation
that produces novel addresses not in the static lists.
"""

import random


FLAT_FORMATS = [
    "Flat {num}{letter}",
    "{num}/{letter}",
    "House No. {num}",
    "Plot {num}",
    "B-{num}",
    "Sector {num} House {letter}{num2}",
    "{num}, {letter} Wing",
]

AREA_NAMES = [
    "MG Road", "Linking Road", "FC Road", "SV Road", "LBS Marg",
    "Ring Road", "Nehru Nagar", "Gandhi Nagar", "Shivaji Nagar",
    "Civil Lines", "Sector 12", "Sector 21", "Phase 2",
    "Koregaon Park", "Baner Road", "Andheri West", "Malad East",
    "Vashi", "Thane West", "Powai", "Kothrud", "Hadapsar",
    "Kalyani Nagar", "Wakad", "Pimple Saudagar", "Hinjawadi",
    "Electronic City", "Whitefield", "Indiranagar", "Jayanagar",
    "Anna Nagar", "T Nagar", "Velachery", "Adyar", "Mylapore",
    "Connaught Place", "Lajpat Nagar", "Vasant Vihar", "Dwarka",
    "Salt Lake", "Park Street", "Behala", "Dum Dum",
    "Banjara Hills", "Jubilee Hills", "Madhapur",
    "Gomti Nagar", "Hazratganj", "Alambagh",
    "Ashram Road", "Satellite", "Navrangpura", "Vastrapur",
    "Shankar Nagar", "Raipur Colony", "Telibandha",
]

CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
    "Kolkata", "Pune", "Ahmedabad", "Surat", "Jaipur",
    "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane",
    "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Agra",
    "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan",
    "Vasai-Virar", "Varanasi", "Srinagar", "Dhanbad", "Jodhpur",
]

STATES = {
    "Maharashtra":     "4",
    "Delhi":           "1",
    "Karnataka":       "5",
    "Telangana":       "5",
    "Tamil Nadu":      "6",
    "West Bengal":     "7",
    "Gujarat":         "3",
    "Rajasthan":       "3",
    "Uttar Pradesh":   "2",
    "Madhya Pradesh":  "4",
    "Bihar":           "8",
    "Andhra Pradesh":  "5",
    "Punjab":          "1",
    "Haryana":         "1",
    "Kerala":          "6",
    "Odisha":          "7",
    "Jharkhand":       "8",
    "Assam":           "7",
    "Chhattisgarh":    "4",
    "Uttarakhand":     "2",
}

# City → (state, PIN prefix)
CITY_STATE_PIN = {
    "Mumbai":         ("Maharashtra",    "400"),
    "Delhi":          ("Delhi",          "110"),
    "Bangalore":      ("Karnataka",      "560"),
    "Hyderabad":      ("Telangana",      "500"),
    "Chennai":        ("Tamil Nadu",     "600"),
    "Kolkata":        ("West Bengal",    "700"),
    "Pune":           ("Maharashtra",    "411"),
    "Ahmedabad":      ("Gujarat",        "380"),
    "Surat":          ("Gujarat",        "395"),
    "Jaipur":         ("Rajasthan",      "302"),
    "Lucknow":        ("Uttar Pradesh",  "226"),
    "Kanpur":         ("Uttar Pradesh",  "208"),
    "Nagpur":         ("Maharashtra",    "440"),
    "Indore":         ("Madhya Pradesh", "452"),
    "Thane":          ("Maharashtra",    "400"),
    "Bhopal":         ("Madhya Pradesh", "462"),
    "Visakhapatnam":  ("Andhra Pradesh", "530"),
    "Patna":          ("Bihar",          "800"),
    "Vadodara":       ("Gujarat",        "390"),
    "Agra":           ("Uttar Pradesh",  "282"),
    "Nashik":         ("Maharashtra",    "422"),
    "Faridabad":      ("Haryana",        "121"),
    "Meerut":         ("Uttar Pradesh",  "250"),
    "Rajkot":         ("Gujarat",        "360"),
    "Varanasi":       ("Uttar Pradesh",  "221"),
    "Jodhpur":        ("Rajasthan",      "342"),
}


def _generate_pin(city: str) -> str:
    prefix = CITY_STATE_PIN.get(city, ("Unknown", "100"))[1]
    suffix = "".join(str(random.randint(0, 9)) for _ in range(3))
    return prefix + suffix


class OllamaAddressGenerator:
    """
    Generates realistic Indian postal addresses via Ollama LLM.

    Produces novel addresses not in the hardcoded lists.
    Falls back to the static AddressGenerator when Ollama is unavailable.

    Usage:
        gen = OllamaAddressGenerator()
        addr = gen.generate()   # "Flat 3B, MG Road, Mumbai, Maharashtra - 400001"
    """

    _BATCH_SIZE = 50

    def __init__(self) -> None:
        self._fallback = AddressGenerator()
        self._cache: list = []
        self._ollama = None
        try:
            from vision_framework.core.llm.ollama_client import OllamaClient
            self._ollama = OllamaClient()
            self._prefill_cache(self._BATCH_SIZE)
        except Exception:
            pass

    def _prefill_cache(self, count: int) -> None:
        if self._ollama is None:
            return
        print(f"[OllamaAddrGen] Generating {count} Indian addresses via Ollama...")
        result = self._ollama.generate_json(
            f"""Generate {count} realistic Indian postal addresses for identity documents.
Include addresses from different states.
Return JSON:
{{
  "addresses": [
    {{
      "line1": "House/Flat number and street",
      "area": "locality/area name",
      "city": "city name",
      "state": "state name",
      "pin": "6-digit PIN code"
    }}
  ]
}}""",
            task="general",
        )
        self._cache = result.get("addresses", [])
        print(f"[OllamaAddrGen] Cached {len(self._cache)} addresses")

    def generate(self) -> str:
        """Return one formatted address string."""
        if not self._cache:
            if self._ollama is not None:
                self._prefill_cache(self._BATCH_SIZE)
            if not self._cache:
                return self._fallback.generate()

        addr = self._cache.pop(0)
        return (
            f"{addr.get('line1', '')}, {addr.get('area', '')}, "
            f"{addr.get('city', '')}, {addr.get('state', '')} - {addr.get('pin', '')}"
        )


class AddressGenerator:
    """Generates realistic Indian postal addresses."""

    def generate(self) -> str:
        """Return a formatted Indian address string."""
        city = random.choice(CITIES)
        state, _ = CITY_STATE_PIN.get(city, ("Maharashtra", "400"))
        pin = _generate_pin(city)
        area = random.choice(AREA_NAMES)

        flat_fmt = random.choice(FLAT_FORMATS)
        flat = flat_fmt.format(
            num=random.randint(1, 120),
            letter=random.choice("ABCDE"),
            num2=random.randint(1, 20),
        )

        return f"{flat}, {area}, {city}, {state} - {pin}"

    def generate_multiline(self) -> list:
        """Return address as list of lines (for wrapped rendering)."""
        addr = self.generate()
        parts = addr.split(", ")
        if len(parts) >= 4:
            return [
                ", ".join(parts[:2]),
                ", ".join(parts[2:]),
            ]
        return [addr]
